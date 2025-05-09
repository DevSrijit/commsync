import { TestimonialsColumn } from "@/components/blocks/testimonials-columns-1";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

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

const TestimonialsV2 = () => {
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


    const testimonials = reviews.map((review) => ({
        text: review.review_text || '',
        image: review.user_avatar,
        name: review.user_name,
        stars: review.review_rate,
    }));

    const columnCount = 3;
    const columnSize = Math.ceil(testimonials.length / columnCount);
    const firstColumn = testimonials.slice(0, columnSize);
    const secondColumn = testimonials.slice(columnSize, columnSize * 2);
    const thirdColumn = testimonials.slice(columnSize * 2, columnSize * 3);

    return (
        <section className="bg-[#FAFAFA] dark:bg-black my-20 relative">

            <div className="container z-10 mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                    viewport={{ once: true }}
                    className="flex flex-col items-center justify-center max-w-[540px] mx-auto"
                >
                    <div className="flex justify-center">
                        <div className="border py-1 px-4 rounded-lg">Testimonials</div>
                    </div>

                    <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tighter mt-5">
                        What our users say
                    </h2>
                    <p className="text-center mt-5 opacity-75">
                        See what our customers have to say about us.
                    </p>
                </motion.div>

                <div className="flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[740px] overflow-hidden">
                    <TestimonialsColumn testimonials={firstColumn} duration={15} />
                    <TestimonialsColumn testimonials={secondColumn} className="hidden md:block" duration={19} />
                    <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={17} />
                </div>
            </div>
        </section>
    );
};

export default TestimonialsV2;