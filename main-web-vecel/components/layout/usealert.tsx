import React, { useState, useEffect } from "react";

// Tab Switching Alert Component
interface TabSwitchingAlertProps {
  message: string;
  onClose: () => void;
}

export const TabSwitchingAlert: React.FC<TabSwitchingAlertProps> = ({ message, onClose }) => {
  return (
    <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-opacity-50 bg-black z-50">
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <p>{message}</p>
        <button onClick={onClose} className="mt-4 p-2 bg-blue-500 text-white rounded">
          Close
        </button>
      </div>
    </div>
  );
};

// Hook to monitor tab switching and generate alert message
export function useTabSwitchingAlert() {
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    let lastFocusTime = Date.now();

    const handleVisibilityChange = () => {
      const currentTime = Date.now();
      if (document.hidden) {
        lastFocusTime = currentTime;
      } else {
        const timeAway = (currentTime - lastFocusTime) / 1000; // time in seconds
        if (timeAway > 0) {
          setAlertMessage("Warning: You switched tabs during the session!");
        } else {
          setAlertMessage(null); // Clear the alert if tab is focused again
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup on component unmount
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return alertMessage;
}

// Hook to manage proctoring status and alert message
export const useProctoringAlert = (isProctoringActive: boolean) => {
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isProctoringActive) {
      setAlertMessage("Proctoring Active: Please remain focused on the session.");
    } else {
      setAlertMessage(null);
    }
  }, [isProctoringActive]);

  return alertMessage;
};

// Hook to manage popup visibility based on alert message
export const usePopupAlert = (alertMessage: string | null) => {
  const [isPopupVisible, setPopupVisible] = useState(false);

  useEffect(() => {
    if (alertMessage) {
      setPopupVisible(true);
    } else {
      setPopupVisible(false);
    }
  }, [alertMessage]);

  return { isPopupVisible, setPopupVisible };
};
