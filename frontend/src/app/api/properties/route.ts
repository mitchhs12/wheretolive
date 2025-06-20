// src/app/api/properties/route.ts
import { NextResponse } from "next/server";
import { Pool } from "pg";

// Create a new pool instance using the connection string from your .env file
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  const client = await pool.connect();

  try {
    // This is the core query. It does two crucial things:
    // 1. ST_SimplifyPreserveTopology: Reduces the complexity of the polygons.
    //    This is VITAL for performance. Sending full-resolution polygons would be very slow.
    //    The '5.0' means we simplify it to a 5-meter tolerance.
    // 2. ST_AsGeoJSON: Converts the binary PostGIS geometry into the standard GeoJSON text format,
    //    which is easy for JavaScript to understand.
    const query = `
      SELECT
        object_id AS source_property_id,
        physical_address AS address,
        capital_value,
        land_value,
        improvements_value,
        land_use_description as type,
        -- THIS IS THE CRITICAL FIX:
        -- 1. Simplify the original geometry (in its native EPSG:2193) for performance.
        -- 2. Transform the simplified geometry from its original SRID (2193) to the web standard SRID (4326 for lat/lng).
        -- 3. Convert the final, correctly projected geometry to a GeoJSON string for the browser.
        ST_AsGeoJSON(
          ST_Transform(
            ST_SimplifyPreserveTopology(geom, 5.0),
            4326
          )
        ) as geojson

      FROM
        properties
      WHERE
        geom IS NOT NULL
    `;

    const { rows } = await client.query(query);

    // The 'geojson' field from the DB is a string, so we need to parse it into a JSON object.
    const properties = rows.map((row) => ({
      ...row,
      geojson: JSON.parse(row.geojson),
    }));

    return NextResponse.json(properties);
  } catch (error) {
    console.error("Failed to fetch properties:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    // IMPORTANT: Release the client back to the pool
    client.release();
  }
}
