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
    const query = `
      SELECT
        *
      FROM
        currencies
    `;

    const { rows } = await client.query(query);

    const currencies = rows;

    return NextResponse.json(currencies);
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
