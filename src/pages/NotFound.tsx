import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col bg-[#06060c]"
    >
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="max-w-5xl mx-auto relative px-4">
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-[#e8e8f8] mb-4">404</h1>
              <p className="text-lg text-[#6e6e8a] mb-6">Page Not Found</p>
              <p className="text-sm text-[#6e6e8a]/60 mb-8">
                The page you're looking for doesn't exist or has been moved.
              </p>
              <Button
                onClick={() => navigate("/")}
                className="bg-gradient-to-r from-[#00d4ff] to-[#8b5cf6] text-[#06060c] font-semibold"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
