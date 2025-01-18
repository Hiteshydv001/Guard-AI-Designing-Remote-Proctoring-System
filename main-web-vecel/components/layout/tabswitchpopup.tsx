import React from 'react';
import { AlertTriangle, Clock, X, AlertCircle, Shield } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface TabSwitchPopupProps {
  onDismiss: () => void;
  switchCount: number;
  timeAway: number;
}

const TabSwitchPopup = ({ onDismiss, switchCount, timeAway }: TabSwitchPopupProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-red-600 dark:text-red-500">
                  Tab Switch Detected!
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  This action has been recorded
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900/30"
              onClick={onDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Alert className="mb-6 border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-500" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              Switching tabs during an exam session may be considered as suspicious activity
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="flex items-center space-x-3 text-sm">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">
                Time away: {timeAway.toFixed(1)} seconds
              </span>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">
                Tab switches: {switchCount} times
              </span>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <Shield className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">
                Proctor has been notified of this activity
              </span>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={onDismiss}
            >
              I Understand
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TabSwitchPopup;