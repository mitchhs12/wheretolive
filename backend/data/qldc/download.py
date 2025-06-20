import requests
import psycopg2
from psycopg2.extras import execute_values
import time
import os
from datetime import datetime, timezone
import dotenv

# Load environment variables from a .env file if it exists
dotenv.load_dotenv()

def sync_arcgis_to_neon():
    """
    Downloads property data from an ArcGIS FeatureServer and upserts it into
    a Neon (PostgreSQL) database. This version now fetches the total count
    first to display progress.
    """
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print("Error: DATABASE_URL environment variable not set.")
        return

    conn = None
    try:
        print("Connecting to the Neon database...")
        conn = psycopg2.connect(db_url)
        print("Connection successful.")

        base_url = "https://services1.arcgis.com/9YyqaQtDdDR8tupG/arcgis/rest/services/Land_Parcels_and_Properties_Data/FeatureServer/0/query"
        where_clause = "CAPITAL_VALUE > 0 AND PHYSADDRESS IS NOT NULL"
        out_fields = [
            "OBJECTID", "PROPERTY_NO", "PHYSADDRESS", "STREET", "LOCALITY", 
            "POSTCODE", "LAND_VALUE", "CAPITAL_VALUE", "IMPROVEMENTS_VALUE",
            "LANDUSEDESCRIPTION", "PROPERTY_TYPE_DESC", "survey_area", "calc_area"
        ]
        
        # --- MODIFICATION: Get total record count first for progress tracking ---
        try:
            print("Fetching total record count from Queenstown API...")
            count_params = {'where': where_clause, 'returnCountOnly': 'true', 'f': 'json'}
            count_response = requests.get(base_url, params=count_params, timeout=60)
            count_response.raise_for_status()
            total_records = count_response.json().get('count', 0)
            if total_records == 0:
                print("No records found matching the criteria. Exiting.")
                return
            print(f"Total records to process: {total_records}")
        except requests.exceptions.RequestException as e:
            print(f"Could not fetch total record count: {e}")
            return

        offset = 0
        records_per_page = 1000
        total_processed = 0
        total_upserted = 0

        print("\nStarting data download and database synchronization...")

        while True:
            params = {
                'where': where_clause,
                'outFields': ",".join(out_fields),
                'returnGeometry': 'true',
                'outSR': '2193',
                'resultRecordCount': records_per_page,
                'resultOffset': offset,
                'f': 'json'
            }

            response = requests.get(base_url, params=params, timeout=60)
            response.raise_for_status()
            data = response.json()
            features = data.get('features', [])
            
            if not features:
                print("\nNo more records returned. Sync finished.")
                break

            num_retrieved = len(features)
            total_processed += num_retrieved
            # --- MODIFICATION: Display progress ---
            progress = (total_processed / total_records) * 100
            print(f"Fetched batch of {num_retrieved}. Progress: {total_processed}/{total_records} ({progress:.2f}%)")

            with conn.cursor() as cur:
                cur.execute("DROP TABLE IF EXISTS temp_properties;")
                cur.execute("""
                    CREATE TEMP TABLE temp_properties (
                        object_id INTEGER, property_no INTEGER, physical_address TEXT,
                        street TEXT, locality TEXT, postcode VARCHAR(4),
                        land_value NUMERIC, capital_value NUMERIC, improvements_value NUMERIC,
                        land_use_description TEXT, property_type_description TEXT,
                        survey_area NUMERIC, calculated_area NUMERIC,
                        valuation_date DATE,
                        last_updated TIMESTAMP WITH TIME ZONE,
                        geometry_wkt TEXT
                    );
                """)

                all_values = []
                for feature in features:
                    attributes = feature.get('attributes', {})
                    object_id = attributes.get('OBJECTID')
                    if object_id is None:
                        continue 

                    geometry = feature.get('geometry', {})
                    
                    wkt_string = None
                    if geometry and 'rings' in geometry:
                        ring = geometry['rings'][0]
                        coord_pairs = [f"{x} {y}" for x, y in ring]
                        wkt_string = f"POLYGON(({', '.join(coord_pairs)}))"
                    
                    values = (
                        object_id,
                        attributes.get('PROPERTY_NO'),
                        attributes.get('PHYSADDRESS'),
                        attributes.get('STREET'),
                        attributes.get('LOCALITY'),
                        attributes.get('POSTCODE'),
                        attributes.get('LAND_VALUE'),
                        attributes.get('CAPITAL_VALUE'),
                        attributes.get('IMPROVEMENTS_VALUE'),
                        attributes.get('LANDUSEDESCRIPTION'),
                        attributes.get('PROPERTY_TYPE_DESC'),
                        attributes.get('survey_area'),
                        attributes.get('calc_area'),
                        None, # valuation_date
                        datetime.now(timezone.utc),
                        wkt_string
                    )
                    all_values.append(values)

                if all_values:
                    execute_values(cur, """
                        INSERT INTO temp_properties (
                            object_id, property_no, physical_address, street, locality,
                            postcode, land_value, capital_value, improvements_value,
                            land_use_description, property_type_description, survey_area,
                            calculated_area, valuation_date, last_updated, geometry_wkt
                        ) VALUES %s;
                    """, all_values)

                upsert_sql = """
                    INSERT INTO properties (
                        object_id, property_no, physical_address, street, locality,
                        postcode, land_value, capital_value, improvements_value,
                        land_use_description, property_type_description, survey_area,
                        calculated_area, valuation_date, last_updated, geom
                    )
                    SELECT
                        object_id, property_no, physical_address, street, locality,
                        postcode, land_value, capital_value, improvements_value,
                        land_use_description, property_type_description, survey_area,
                        calculated_area, valuation_date, last_updated, ST_GeomFromText(geometry_wkt, 2193)
                    FROM temp_properties
                    ON CONFLICT (object_id) DO UPDATE SET
                        property_no = EXCLUDED.property_no,
                        physical_address = EXCLUDED.physical_address,
                        capital_value = EXCLUDED.capital_value,
                        valuation_date = EXCLUDED.valuation_date,
                        last_updated = EXCLUDED.last_updated,
                        geom = EXCLUDED.geom
                    WHERE
                        properties.capital_value IS DISTINCT FROM EXCLUDED.capital_value OR
                        properties.physical_address IS DISTINCT FROM EXCLUDED.physical_address;
                """
                cur.execute(upsert_sql)
                
                rows_affected = cur.rowcount
                total_upserted += rows_affected
                
                conn.commit()
                print(f"Batch committed. {rows_affected} rows were inserted/updated.")
            
            if num_retrieved < records_per_page:
                print("Last page reached.")
                break
                
            offset += records_per_page
            time.sleep(0.5)

    except (requests.exceptions.RequestException, psycopg2.Error) as e:
        print(f"\nAn error occurred: {e}")
        if conn: conn.rollback()
    except Exception as e:
        print(f"\nAn unexpected error occurred: {e}")
        if conn: conn.rollback()
    finally:
        if conn: conn.close()
        print("\nDatabase connection closed.")

    print(f"\n--- Sync Summary ---")
    print(f"Total records processed from API: {total_processed}")
    print(f"Total records inserted or updated in database: {total_upserted}")
    print(f"--- End of Summary ---")

if __name__ == '__main__':
    sync_arcgis_to_neon()