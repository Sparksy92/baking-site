import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query(
      `SELECT initials, score, created_at 
       FROM fishing_highscores 
       ORDER BY score DESC 
       LIMIT 10`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching highscores:', error);
    return NextResponse.json({ error: 'Failed to fetch highscores' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { initials, score } = body;

    if (!initials || typeof initials !== 'string' || initials.length > 3) {
      return NextResponse.json({ error: 'Invalid initials' }, { status: 400 });
    }

    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO fishing_highscores (initials, score) 
       VALUES ($1, $2) 
       RETURNING initials, score, created_at`,
      [initials.toUpperCase(), score]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error submitting highscore:', error);
    return NextResponse.json({ error: 'Failed to submit highscore' }, { status: 500 });
  }
}
