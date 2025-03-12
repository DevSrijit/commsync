import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Contact {
    id: string;
    name: string;
    avatar?: string;
    lastMessage?: string;
    lastMessageTime?: string;
    unreadCount?: number;
    status?: "online" | "offline" | "busy";
}

export function ContactList({
    contacts = [],
    isLoading = false,
    onSelectContact,
    selectedContactId
}: {
    contacts: Contact[];
    isLoading?: boolean;
    onSelectContact: (contact: Contact) => void;
    selectedContactId?: string;
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [filteredContacts, setFilteredContacts] = useState(contacts);

    useEffect(() => {
        setFilteredContacts(
            contacts.filter(contact =>
                contact.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
    }, [contacts, searchQuery]);

    return (
        <div className="flex flex-col h-full border-r">
            <div className="p-4 border-b">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search contacts..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 p-2">
                {isLoading ? (
                    // Skeleton loading state
                    Array(5).fill(0).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 mb-2 rounded-lg">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-3 w-4/5" />
                            </div>
                        </div>
                    ))
                ) : (
                    filteredContacts.map(contact => (
                        <Button
                            key={contact.id}
                            variant={selectedContactId === contact.id ? "secondary" : "ghost"}
                            className={`w-full justify-start mb-1 p-3 h-auto transition-all ${selectedContactId === contact.id ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
                            onClick={() => onSelectContact(contact)}
                        >
                            <div className="flex items-center gap-3 w-full">
                                <Avatar className="relative h-10 w-10 border">
                                    <AvatarImage src={contact.avatar} alt={contact.name} />
                                    <AvatarFallback>{contact.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    {contact.status && (
                                        <span
                                            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-background ${contact.status === "online" ? "bg-green-500" :
                                                    contact.status === "busy" ? "bg-amber-500" : "bg-gray-300"
                                                }`}
                                        />
                                    )}
                                </Avatar>

                                <div className="flex-1 truncate">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium truncate">{contact.name}</span>
                                        {contact.lastMessageTime && (
                                            <span className="text-xs text-muted-foreground">{contact.lastMessageTime}</span>
                                        )}
                                    </div>

                                    {contact.lastMessage && (
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-sm text-muted-foreground truncate">{contact.lastMessage}</span>
                                            {contact.unreadCount && contact.unreadCount > 0 ? (
                                                <Badge variant="secondary" className="text-xs">
                                                    {contact.unreadCount}
                                                </Badge>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Button>
                    ))
                )}
            </ScrollArea>
        </div>
    );
}
