import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OrbitingCircles } from "@/components/magicui/orbiting-circles";
import { SiWhatsapp, SiTwilio, SiGmail, SiReddit, SiDiscord, SiGooglemessages } from "@icons-pack/react-simple-icons";
import { Spotlight } from "@/components/ui/spotlight-new";
import AnimatedGradientBackground from "@/components/ui/animated-gradient-background";
export default function PreFooter() {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Update visibility state based on intersection
        setIsVisible(entry.isIntersecting);
      },
      {
        threshold: 0.5, // Trigger when 50% of the element is visible
        rootMargin: "0px"
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={sectionRef}
      className="relative flex flex-col items-center justify-center lg:flex-row lg:items-center lg:justify-between min-h-screen px-6 py-12 md:px-10 lg:px-16 overflow-hidden bg-[#FAFAFA] dark:bg-black"
    >
      <AnimatedGradientBackground />

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            <Spotlight />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        <motion.div
          className="relative w-full lg:w-1/2 mb-12 lg:mb-0 z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0.5, y: 10 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl tracking-tighter font-geist bg-clip-text text-transparent mx-auto md:text-6xl text-left bg-[linear-gradient(180deg,_#000_0%,_rgba(0,_0,_0,_0.75)_100%)] dark:bg-[linear-gradient(180deg,_#FFF_0%,_rgba(255,_255,_255,_0.00)_202.08%)]">
            Make your <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 dark:from-purple-300 dark:to-orange-200">business communication</span> easier
          </h1>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        <motion.div
          className="relative flex h-[350px] md:h-[400px] lg:h-[500px] w-full lg:w-1/2 flex-col items-center justify-center overflow-hidden z-10"
          initial={{ opacity: 0 }}
          animate={isVisible ? { opacity: 1 } : { opacity: 0.5 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <OrbitingCircles iconSize={40}>
            <SiWhatsapp />
            <SiReddit />
            <SiTwilio />
          </OrbitingCircles>
          <OrbitingCircles iconSize={30} radius={100} reverse speed={2}>
            <SiGmail />
            <SiDiscord />
            <SiGooglemessages />
          </OrbitingCircles>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}