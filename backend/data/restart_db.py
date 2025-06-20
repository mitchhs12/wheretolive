import os
import psycopg2
import dotenv

# Load environment variables from a .env file if it exists
dotenv.load_dotenv()

def reset_database_schema():
    """
    Connects to a Neon (PostgreSQL) database and completely resets the
    'properties' table.

    This version adds a 'valuation_date' column.
    """
    # --- Database Connection ---
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print("Error: DATABASE_URL environment variable not set.")
        print("Please set it to your Neon connection string.")
        return

    conn = None
    try:
        print("Connecting to the Neon database to reset schema...")
        conn = psycopg2.connect(db_url)
        print("Connection successful.")

        # Use a cursor to execute SQL commands
        with conn.cursor() as cur:
            print("Dropping 'properties' table if it exists...")
            cur.execute("DROP TABLE IF EXISTS properties CASCADE;")
            print("'properties' table dropped.")

            print("Enabling PostGIS extension...")
            cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
            print("PostGIS extension is enabled.")
            
            print("Creating new 'properties' table with 'valuation_date' column...")
            create_table_sql = """
            CREATE TABLE properties (
                object_id INTEGER PRIMARY KEY,
                property_no INTEGER,
                physical_address TEXT,
                street TEXT,
                locality TEXT,
                postcode VARCHAR(4),
                land_value NUMERIC,
                capital_value NUMERIC,
                improvements_value NUMERIC,
                land_use_description TEXT,
                property_type_description TEXT,
                survey_area NUMERIC,
                calculated_area NUMERIC,
                valuation_date DATE,
                last_updated TIMESTAMP WITH TIME ZONE,
                district TEXT,
                geom GEOMETRY(POLYGON, 2193)
            );
            """
            cur.execute(create_table_sql)
            print("'properties' table created successfully.")
        
        conn.commit()
        print("\nDatabase reset complete!")

    except psycopg2.Error as e:
        print(f"\nA database error occurred: {e}")
        if conn:
            conn.rollback() 

    except Exception as e:
        print(f"\nAn unexpected error occurred: {e}")

    finally:
        if conn:
            conn.close()
            print("Database connection closed.")

if __name__ == '__main__':
    confirm = input("Are you sure you want to completely reset the database table? This is irreversible. (yes/no): ")
    if confirm.lower() == 'yes':
        reset_database_schema()
    else:
        print("Operation cancelled.")