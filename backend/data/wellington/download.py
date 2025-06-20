import requests
import psycopg2
from psycopg2.extras import execute_values
import os
import time
from datetime import datetime, timezone
import dotenv

dotenv.load_dotenv()

def sync_wellington_to_neon():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print("Error: DATABASE_URL not set.")
        return

    conn = None
    try:
        print("Connecting to Neon...")
        conn = psycopg2.connect(db_url)
        print("Connected.")

        base_url = "https://gis.wcc.govt.nz/arcgis/rest/services/PropertyAndBoundaries/Property/MapServer/0/query"
        where_clause = "CapitalValue > 0"

        out_fields = [
            "OBJECTID", "FullAddress", "ValuationID", "CapitalValue", "LandValue",
            "ImprovementsValue", "ValuationDate", "LegalDescription", "Title",
            "RollNumber", "AssessmentNumber", "StreetNumber", "StreetName",
            "Suburb", "PostCode", "LandArea"
        ]

        # Step 1: Get total count
        print("Fetching total record count...")
        count_params = {
            'where': where_clause,
            'returnCountOnly': 'true',
            'f': 'json'
        }
        total_records = requests.get(base_url, params=count_params).json().get('count', 0)
        print(f"Total records to fetch: {total_records}")

        offset = 0
        batch_size = 1000
        total_upserted = 0

        while True:
            params = {
                'where': where_clause,
                'outFields': ",".join(out_fields),
                'returnGeometry': 'true',
                'outSR': '2193',
                'resultOffset': offset,
                'resultRecordCount': batch_size,
                'f': 'json'
            }

            res = requests.get(base_url, params=params)
            res.raise_for_status()
            data = res.json()

            features = data.get("features", [])
            if not features:
                break

            print(f"Fetched {len(features)} records (offset {offset})")

            with conn.cursor() as cur:
                cur.execute("DROP TABLE IF EXISTS temp_properties;")
                cur.execute("""
                    CREATE TEMP TABLE temp_properties (
                        object_id INTEGER, property_no INTEGER, physical_address TEXT,
                        street TEXT, locality TEXT, postcode VARCHAR(10),
                        land_value NUMERIC, capital_value NUMERIC, improvements_value NUMERIC,
                        land_use_description TEXT, property_type_description TEXT,
                        survey_area NUMERIC, calculated_area NUMERIC,
                        valuation_date DATE, last_updated TIMESTAMPTZ,
                        district TEXT, geometry_wkt TEXT
                    );
                """)

                values = []
                for f in features:
                    attr = f['attributes']
                    geom = f.get('geometry', {})

                    object_id = attr.get("OBJECTID")
                    wkt = None
                    if geom and "rings" in geom:
                        ring = geom["rings"][0]
                        coords = [f"{x} {y}" for x, y in ring]
                        wkt = f"POLYGON(({', '.join(coords)}))"

                    # Parse Valuation Date
                    raw_date = attr.get("ValuationDate")
                    try:
                        valuation_date = datetime.strptime(raw_date, "%d/%m/%Y").date() if raw_date else None
                    except:
                        valuation_date = None

                    values.append((
                        object_id,
                        attr.get("AssessmentNumber"),
                        attr.get("FullAddress"),
                        attr.get("StreetName"),
                        attr.get("Suburb"),
                        attr.get("PostCode"),
                        attr.get("LandValue"),
                        attr.get("CapitalValue"),
                        attr.get("ImprovementsValue"),
                        attr.get("LegalDescription"),
                        attr.get("Title"),
                        float(attr.get("LandArea")) if attr.get("LandArea") else None,
                        None,
                        valuation_date,
                        datetime.now(timezone.utc),
                        "Wellington",
                        wkt
                    ))

                if values:
                    execute_values(cur, """
                        INSERT INTO temp_properties (
                            object_id, property_no, physical_address, street, locality,
                            postcode, land_value, capital_value, improvements_value,
                            land_use_description, property_type_description, survey_area,
                            calculated_area, valuation_date, last_updated, district, geometry_wkt
                        ) VALUES %s;
                    """, values)

                    cur.execute("""
                        INSERT INTO properties (
                            object_id, property_no, physical_address, street, locality,
                            postcode, land_value, capital_value, improvements_value,
                            land_use_description, property_type_description, survey_area,
                            calculated_area, valuation_date, last_updated, district, geom
                        )
                        SELECT
                            object_id, property_no, physical_address, street, locality,
                            postcode, land_value, capital_value, improvements_value,
                            land_use_description, property_type_description, survey_area,
                            calculated_area, valuation_date, last_updated, district,
                            ST_GeomFromText(geometry_wkt, 2193)
                        FROM temp_properties
                        ON CONFLICT (object_id) DO UPDATE SET
                            capital_value = EXCLUDED.capital_value,
                            physical_address = EXCLUDED.physical_address,
                            valuation_date = EXCLUDED.valuation_date,
                            last_updated = EXCLUDED.last_updated,
                            district = EXCLUDED.district,
                            geom = EXCLUDED.geom
                        WHERE
                            properties.capital_value IS DISTINCT FROM EXCLUDED.capital_value OR
                            properties.physical_address IS DISTINCT FROM EXCLUDED.physical_address;
                    """)

                    conn.commit()
                    total_upserted += cur.rowcount
                    print(f"Committed batch. Upserted {cur.rowcount} rows.")

            offset += batch_size
            time.sleep(0.25)

        print(f"\n✅ Sync complete. Total upserted: {total_upserted}")

    except Exception as e:
        print(f"Error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()
            print("Connection closed.")

if __name__ == "__main__":
    sync_wellington_to_neon()
