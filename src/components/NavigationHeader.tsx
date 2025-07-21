import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, X, User, LogOut, History, Settings, Brain, MessageCircle } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { signOut } from "firebase/auth";
import { auth } from "@/config/firebase";
import { toast } from "sonner";
import AuthModal from "./AuthModal";

interface NavigationHeaderProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const NavigationHeader = ({ currentView, onViewChange }: NavigationHeaderProps) => {
  const [user, loading] = useAuthState(auth);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
      onViewChange("study");
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  const navItems = [
    { id: "study", label: "Study Assistant", icon: Brain },
    { id: "arivu", label: "Arivu Chat", icon: MessageCircle },
    { id: "history", label: "Study History", icon: History },
    { id: "profile", label: "Profile", icon: Settings },
  ];

  return (
    <>
      <header className="bg-white/95 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50 shadow-xl transition-all duration-300">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-md pulse-glow">
                <Brain className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold gradient-text">
                  Ram's AI
                </h1>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2 lg:gap-4">
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  variant={currentView === item.id ? "default" : "ghost"}
                  onClick={() => onViewChange(item.id)}
                  className={`flex items-center gap-2 px-2 lg:px-3 py-2 rounded-lg transition-all duration-300 ${
                    currentView === item.id 
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-md transform scale-105" 
                      : "text-gray-700 hover:text-blue-600 hover:bg-blue-50 hover:shadow-sm hover:scale-102"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden lg:inline text-sm font-medium">{item.label}</span>
                </Button>
              ))}
            </nav>

            {/* User Section */}
            <div className="flex items-center gap-2 md:gap-4">
              {user ? (
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-medium text-gray-900">
                      +91{user.phoneNumber?.replace('+91', '')}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      Verified
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all duration-300 hover:scale-105"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="btn-primary flex items-center gap-2 px-3 md:px-4"
                  disabled={loading}
                  size="sm"
                >
                  <User className="h-4 w-4" />
                  <span className="text-sm">Login</span>
                </Button>
              )}

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

            {/* Enhanced Mobile Navigation */}
            {isMobileMenuOpen && (
              <nav className="md:hidden py-4 border-t border-gray-200/50 bg-white/98 backdrop-blur-xl animate-fadeInUp shadow-lg">
                <div className="space-y-2 px-2">
                  {navItems.map((item) => (
                    <Button
                      key={item.id}
                      variant="ghost"
                      onClick={() => {
                        onViewChange(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full justify-start flex items-center gap-3 px-4 py-3 rounded-xl ${
                        currentView === item.id 
                          ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transform scale-102" 
                          : "text-gray-700 hover:text-blue-600 hover:bg-blue-50 hover:shadow-sm"
                      } transition-all duration-300`}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </Button>
                  ))}
                </div>
              </nav>
            )}
        </div>
      </header>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          toast.success("Welcome to Ram's AI!");
        }}
      />
    </>
  );
};

export default NavigationHeader;
