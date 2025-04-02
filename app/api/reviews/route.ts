import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const CACHE_KEY = "google_maps_reviews";
const CACHE_TTL = 60 * 60 * 24; // 24 hours

interface Review {
  user_name: string;
  user_avatar: string;
  review_text: string | null;
  review_rate: number;
  review_time: string;
  review_link: string;
  user_total_reviews: number;
  user_total_photos: number;
  user_link: string;
}

async function fetchReviews(cursor?: string) {
  const url = new URL("https://maps-data.p.rapidapi.com/reviews.php");
  url.searchParams.append(
    "business_id",
    "0x49ea1f49df4d1183:0xe4425c4db09c29f0"
  );
  url.searchParams.append("country", "us");
  url.searchParams.append("lang", "en");
  url.searchParams.append("limit", "20");
  url.searchParams.append("sort", "Relevant");

  if (cursor) {
    url.searchParams.append("cursor", cursor);
  }

  const response = await fetch(url.toString(), {
    headers: {
      "x-rapidapi-host": "maps-data.p.rapidapi.com",
      "x-rapidapi-key": process.env.RAPIDAPI_KEY || "",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch reviews");
  }

  const data = await response.json();

  // Ensure we're getting the reviews array from the correct path in the response
  if (!data.data?.reviews) {
    throw new Error("Invalid response format");
  }

  // Clean and validate each review
  const cleanedReviews = data.data.reviews.map(
    (review: any): Review => ({
      user_name: review.user_name || "",
      user_avatar:
        review.user_avatar?.replace("=s120-c-rp-mo", "=s192-c-rp-mo") || "",
      review_text: review.review_text || null,
      review_rate: review.review_rate || 0,
      review_time: review.review_time || "",
      review_link: review.review_link || "",
      user_total_reviews: review.user_total_reviews || 0,
      user_total_photos: review.user_total_photos || 0,
      user_link: review.user_link || "",
    })
  );

  return cleanedReviews;
}

export async function GET() {
  try {
    // Try to get cached reviews
    let cachedReviews = await kv.get<Review[]>(CACHE_KEY);

    if (!cachedReviews) {
      // If no cached data, fetch new reviews
      const reviews = await fetchReviews();

      // Cache the reviews
      await kv.set(CACHE_KEY, reviews, { ex: CACHE_TTL });
      cachedReviews = reviews;
    }

    return NextResponse.json({ reviews: cachedReviews });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}
