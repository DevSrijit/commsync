import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Send, Paperclip, Phone, Video, MoreVertical } from "lucide-react";

interface Message {
    id: string;
    content: string;
    timestamp: string;
    sender: "user" | "contact";
    status?: "sending" | "sent" | "delivered" | "read";
    type?: "text" | "image" | "file";
    fileUrl?: string;
}

interface Contact {
    id: string;
    name: string;
    avatar?: string;
    status?: "online" | "offline" | "busy";
}

export function ConversationPanel({
    contact,
    messages = [],
    isLoading = false,
    onSendMessage
}: {
    contact: Contact | null;
    messages: Message[];
    isLoading?: boolean;
    onSendMessage?: (message: string) => void;
}) {
    const [messageText, setMessageText] = useState("");
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        if (endOfMessagesRef.current) {
            endOfMessagesRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSendMessage = () => {
        if (messageText.trim() && onSendMessage) {
            onSendMessage(messageText);
            setMessageText("");
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    if (!contact) {
        return (
            <div className="flex items-center justify-center h-full bg-muted/30">
                <div className="text-center">
                    <h3 className="text-lg font-medium">Select a contact to start messaging</h3>
                    <p className="text-sm text-muted-foreground mt-1">Choose from your contacts list to begin a conversation</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={contact.avatar} alt={contact.name} />
                        <AvatarFallback>{contact.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h3 className="font-medium">{contact.name}</h3>
                        <p className="text-xs text-muted-foreground">
                            {contact.status === "online" ? "Online" :
                                contact.status === "busy" ? "Busy" : "Offline"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost">
                        <Phone className="h-5 w-5" />
                    </Button>
                    <Button size="icon" variant="ghost">
                        <Video className="h-5 w-5" />
                    </Button>
                    <Button size="icon" variant="ghost">
                        <MoreVertical className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Conversation Tabs */}
            <Tabs defaultValue="messages" className="flex flex-col flex-1">
                <div className="border-b px-4">
                    <TabsList className="h-10">
                        <TabsTrigger value="messages" className="text-sm">Messages</TabsTrigger>
                        <TabsTrigger value="emails" className="text-sm">Emails</TabsTrigger>
                        <TabsTrigger value="whatsapp" className="text-sm">WhatsApp</TabsTrigger>
                        <TabsTrigger value="files" className="text-sm">Files</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="messages" className="flex-1 flex flex-col p-0 mt-0">
                    {/* Messages Area */}
                    <ScrollArea className="flex-1 p-4">
                        {isLoading ? (
                            // Skeleton loading state for messages
                            Array(4).fill(0).map((_, i) => (
                                <div key={i} className={`flex items-start mb-4 ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                                    {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full mr-2" />}
                                    <div className={`max-w-[70%] ${i % 2 === 0 ? 'ml-12' : 'mr-12'}`}>
                                        <Skeleton className={`h-16 ${i % 2 === 0 ? 'rounded-tl-lg rounded-bl-lg rounded-tr-lg' : 'rounded-tr-lg rounded-br-lg rounded-tl-lg'}`} />
                                        <Skeleton className="h-3 w-20 mt-1" />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <>
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`flex mb-4 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        {message.sender === 'contact' && (
                                            <Avatar className="h-8 w-8 mr-2 mt-1">
                                                <AvatarImage src={contact.avatar} alt={contact.name} />
                                                <AvatarFallback>{contact.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                        )}

                                        <div className={`max-w-[70%] ${message.sender === 'user' ? 'order-1' : 'order-2'}`}>
                                            <div
                                                className={`p-3 rounded-lg ${message.sender === 'user'
                                                        ? 'bg-primary text-primary-foreground rounded-br-none'
                                                        : 'bg-muted rounded-bl-none'
                                                    }`}
                                            >
                                                {message.content}

                                                {message.status && message.sender === 'user' && (
                                                    <span className="ml-2 text-xs opacity-70 float-right mt-1">
                                                        {message.status === 'sending' ? '⋯' :
                                                            message.status === 'sent' ? '✓' :
                                                                message.status === 'delivered' ? '✓✓' :
                                                                    message.status === 'read' ? '✓✓' : ''}
                                                    </span>
                                                )}
                                            </div>
                                            <div className={`text-xs text-muted-foreground mt-1 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
                                                {message.timestamp}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={endOfMessagesRef} />
                            </>
                        )}
                    </ScrollArea>

                    {/* Message Input */}
                    <div className="p-4 border-t">
                        <div className="flex items-center gap-2">
                            <Button size="icon" variant="ghost">
                                <Paperclip className="h-5 w-5" />
                            </Button>
                            <Input
                                placeholder="Type a message..."
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                onKeyDown={handleKeyPress}
                                className="flex-1"
                            />
                            <Button
                                size="icon"
                                onClick={handleSendMessage}
                                disabled={messageText.trim() === ''}
                            >
                                <Send className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="emails" className="h-full flex flex-col">
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <h3 className="text-lg font-medium">Email Integration</h3>
                            <p className="text-sm text-muted-foreground mt-1">All emails with this contact will appear here</p>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="whatsapp" className="h-full flex flex-col">
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <h3 className="text-lg font-medium">WhatsApp Integration</h3>
                            <p className="text-sm text-muted-foreground mt-1">WhatsApp messages with this contact will appear here</p>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="files" className="h-full flex flex-col">
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <h3 className="text-lg font-medium">Shared Files</h3>
                            <p className="text-sm text-muted-foreground mt-1">Files shared with this contact will appear here</p>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
