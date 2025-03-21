"use client";

import { toast } from "@/hooks/use-toast";
import { sendEmail } from "@/lib/gmail-api"; // For Gmail API
import { useState } from "react";

// Updated MessagePlatform type to match our supported platforms
export type MessagePlatform = "gmail" | "imap" | "twilio" | "justcall";

export interface MessageAttachment {
  name: string;
  content: string;
  type: string;
}

export interface MessageData {
  platform: MessagePlatform;
  recipients: string;
  subject?: string;
  content: string;
  attachments?: File[];
  accountId?: string; // Added accountId for platform-specific accounts
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
        case "gmail":
          if (!options.accessToken) {
            throw new Error("Gmail sending requires an access token");
          }

          result = await sendEmail({
            accessToken: options.accessToken,
            to: messageData.recipients,
            subject: messageData.subject || "No subject",
            body: messageData.content,
            attachments: messageData.attachments || [], // Pass attachments to sendEmail
          });
          break;

        case "imap":
          if (!messageData.accountId) {
            throw new Error("IMAP sending requires an account ID");
          }

          // Call IMAP API endpoint
          const imapResponse = await fetch("/api/imap", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "sendEmail",
              data: {
                accountId: messageData.accountId,
                to: messageData.recipients,
                subject: messageData.subject || "No subject",
                body: messageData.content,
                html: messageData.content, // HTML content is the same as text for now
              },
            }),
          });

          if (!imapResponse.ok) {
            const errorData = await imapResponse.json();
            throw new Error(errorData.error || "Failed to send IMAP email");
          }

          result = await imapResponse.json();
          break;

        case "twilio":
          if (!messageData.accountId) {
            throw new Error("Twilio sending requires an account ID");
          }

          // Call Twilio API endpoint
          const twilioResponse = await fetch("/api/twilio/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              twilioAccountId: messageData.accountId,
              to: messageData.recipients,
              body: messageData.content,
              // Media attachments could be added here later
            }),
          });

          if (!twilioResponse.ok) {
            const errorData = await twilioResponse.json();
            throw new Error(errorData.error || "Failed to send Twilio message");
          }

          result = await twilioResponse.json();
          break;

        case "justcall":
          if (!messageData.accountId) {
            throw new Error("JustCall sending requires an account ID");
          }

          // Call JustCall API endpoint
          const justcallResponse = await fetch("/api/justcall/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              accountId: messageData.accountId,
              to: messageData.recipients,
              body: messageData.content,
              // Media attachments could be added here later
            }),
          });

          if (!justcallResponse.ok) {
            const errorData = await justcallResponse.json();
            throw new Error(errorData.error || "Failed to send JustCall message");
          }

          result = await justcallResponse.json();
          break;

        default:
          throw new Error(`Unsupported platform: ${messageData.platform}`);
      }

      setStatus({
        sending: false,
        success: true,
        error: null,
      });

      // Update toast on success
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

      // Update toast on error
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
