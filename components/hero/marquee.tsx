import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

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

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < rating ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    async function fetchReviews() {
      try {
        const response = await fetch('/api/reviews');
        const data = await response.json();
        setReviews(data.reviews || []);
      } catch (error) {
        console.error('Error fetching reviews:', error);
      }
    }

    fetchReviews();
  }, []);

  // Duplicate reviews for smooth infinite scroll
  const duplicatedReviews = [...reviews, ...reviews];

  const getAvatarUrl = (url: string) => {
    // Check if it's a Google profile picture
    if (url.includes('googleusercontent.com')) {
      // Already processed in the API to be 192px
      return url;
    }
    return url;
  };

  return (
    <section className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
            What Our Clients Say
          </h2>
          <p className="mt-4 text-lg leading-7 text-gray-600">
            Real reviews from our valued customers on Google Maps
          </p>
        </div>

        <div className="relative">
          <div className="overflow-hidden">
            <motion.div
              animate={{ x: ["0%", "-50%"] }}
              transition={{
                duration: 40,
                repeat: Infinity,
                ease: "linear",
              }}
              className="flex gap-8 whitespace-nowrap"
            >
              {duplicatedReviews.map((review, i) => (
                <div
                  key={i}
                  className="flex-none w-[450px] bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-8"
                  style={{
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)'
                  }}
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100 ring-2 ring-white shadow-sm">
                      {review.user_avatar && !review.user_avatar.includes('default_avatar') ? (
                        <Image
                          src={getAvatarUrl(review.user_avatar)}
                          alt={review.user_name}
                          fill
                          className="object-cover"
                          sizes="48px"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-blue-50">
                          <span className="text-xl font-medium text-blue-600">
                            {review.user_name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 text-base leading-6">
                        {review.user_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <StarRating rating={review.review_rate} />
                        <span className="text-sm text-gray-500 font-medium">
                          {review.review_time}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {review.review_text ? (
                      <>
                        <p className="text-gray-700 text-base leading-relaxed line-clamp-6 break-words whitespace-normal">
                          {review.review_text}
                        </p>
                        {review.review_text.length > 300 && (
                          <a
                            href={review.review_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors mt-2 group"
                          >
                            Read more
                            <svg
                              className="w-4 h-4 ml-1 transform transition-transform group-hover:translate-x-0.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </a>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-500 text-base italic">No review text provided</p>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-gray-50 to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none" />
        </div>
      </div>
    </section>
  );
}