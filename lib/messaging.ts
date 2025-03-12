"use client";

import { toast } from "@/hooks/use-toast";
import { sendEmail } from "@/lib/gmail-api"; // Assuming this exists based on the code
import { useState } from "react";

export type MessagePlatform = "email" | "whatsapp" | "sms" | "slack" | "reddit";

export type MessageAttachment = File;

export interface MessageData {
  platform: MessagePlatform;
  recipients: string;
  subject?: string;
  content: string;
  attachments?: MessageAttachment[];
}

export interface SendOptions {
  accessToken?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: any) => void;
  addToStore?: boolean;
}

export interface MessageStatus {
  sending: boolean;
  success: boolean;
  error: string | null;
}

export const useSendMessage = () => {
  const [status, setStatus] = useState<MessageStatus>({
    sending: false,
    success: false,
    error: null,
  });

  const resetStatus = () => {
    setStatus({
      sending: false,
      success: false,
      error: null,
    });
  };

  const sendMessage = async (
    messageData: MessageData,
    options: SendOptions = {}
  ) => {
    resetStatus();
    setStatus((prev) => ({ ...prev, sending: true }));

    // Show outbox toast
    const toastResult = toast({
      title: "Sending message",
      description: "Your message is being sent...",
      duration: 5000,
    });

    try {
      let result;

      // Handle different platforms
      switch (messageData.platform) {
        case "email":
          if (!options.accessToken) {
            throw new Error("Email sending requires an access token");
          }

          result = await sendEmail({
            accessToken: options.accessToken,
            to: messageData.recipients,
            subject: messageData.subject || "No subject",
            body: messageData.content,
            // Handle attachments if your sendEmail function supports them
          });

          break;

        case "whatsapp":
          // Future implementation
          throw new Error("WhatsApp integration coming soon");

        case "sms":
          // Future implementation
          throw new Error("SMS integration coming soon");

        case "slack":
          // Future implementation
          throw new Error("Slack integration coming soon");

        default:
          throw new Error(`Unsupported platform: ${messageData.platform}`);
      }

      setStatus({
        sending: false,
        success: true,
        error: null,
      });

      // Update toast on success - handle potential type mismatch
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully",
        variant: "success",
        duration: 3000,
      });

      // Call success callback if provided
      if (options.onSuccess) {
        options.onSuccess(result);
      }

      return result;
    } catch (error: any) {
      console.error("Failed to send message:", error);

      setStatus({
        sending: false,
        success: false,
        error: error.message || "Failed to send message",
      });

      // Update toast on error - handle potential type mismatch
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again later",
        variant: "destructive",
        duration: 5000,
      });

      // Call error callback if provided
      if (options.onError) {
        options.onError(error);
      }

      throw error;
    }
  };

  return {
    sendMessage,
    status,
    resetStatus,
  };
};

// Direct function for components that don't need React state
export const sendMessage = async (
  messageData: MessageData,
  options: SendOptions = {}
) => {
  const { sendMessage } = useSendMessage();
  return sendMessage(messageData, options);
};
