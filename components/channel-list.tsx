"use client";

import { useState } from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEmailStore } from "@/lib/email-store";
import { ContactItem } from "@/components/contact-item";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MessageCategory } from "@/components/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Group } from "@/lib/types";

interface EmailListProps {
  isLoading: boolean;
  selectedContact: string | null;
  onSelectContact: (email: string, isGroup?: boolean, groupId?: string) => void;
  className?: string;
}

export function EmailList({
  isLoading,
  selectedContact,
  onSelectContact,
  className,
}: EmailListProps) {
  const { contacts, emails, activeFilter, groups } = useEmailStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const filteredContacts = contacts.filter((contact) => {
    // First filter by search query
    const matchesSearch =
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Then filter by category
    const contactEmails = emails.filter(
      (email) =>
        email.from.email === contact.email ||
        email.to.some((to) => to.email === contact.email)
    );

    switch (activeFilter) {
      case "inbox":
        return contactEmails.some(
          (email) =>
            !email.labels.includes("TRASH") && !email.labels.includes("SENT")
        );
      case "draft":
        return contactEmails.some((email) => email.labels.includes("DRAFT"));
      case "sent":
        return contactEmails.some((email) => email.labels.includes("SENT"));
      case "starred":
        return contactEmails.some((email) => email.labels.includes("STARRED"));
      case "trash":
        return contactEmails.some((email) => email.labels.includes("TRASH"));
      case "archive":
        return contactEmails.some((email) => email.labels.includes("ARCHIVE"));
      default:
        return true;
    }
  });

  // Filter groups based on search query
  const filteredGroups =
    groups?.filter((group) =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  // Function to handle group selection
  const handleGroupSelect = (group: Group) => {
    // Store the selected group ID locally
    setSelectedGroupId(group.id);
    // Pass the first email address as the contact email, the group ID, and isGroup flag
    if (group.addresses.length > 0) {
      onSelectContact(group.addresses[0], true, group.id);
    }
  };

  // New function to render a group item with the same style as ContactItem
  const GroupItem = ({ group, isSelected, onClick }: {
    group: Group; 
    isSelected: boolean; 
    onClick: () => void;
  }) => {
    return (
      <div
        className={`flex items-center gap-3 p-3 cursor-pointer transition-all border m-2 rounded-lg ${
          isSelected ? "bg-secondary" : "hover:bg-secondary/50"
        }`}
        onClick={onClick}
      >
        <Avatar className="h-10 w-10 border">
          <AvatarFallback className="bg-white text-black">
            {group.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 truncate">
          <div className="flex items-center justify-between">
            <span className="font-medium truncate">{group.name}</span>
          </div>
          <span className="text-sm text-muted-foreground truncate">
            {group.addresses.length} members
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "max-w-full border-r border-border flex flex-col w-full z-10 h-full",
        className
      )}
    >
      <div className="p-4 border-b border-border">
        <div className="sticky top-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[160px]" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full">
            {/* Display Groups */}
            {filteredGroups.length > 0 && (
              <div className="mb-2">
                <h3 className="text-sm font-medium text-muted-foreground px-4 py-2">
                  Groups
                </h3>
                {filteredGroups.map((group) => (
                  <GroupItem
                    key={group.id}
                    group={group}
                    isSelected={selectedGroupId === group.id}
                    onClick={() => handleGroupSelect(group)}
                  />
                ))}
              </div>
            )}

            {/* Display Contacts */}
            {filteredContacts.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground px-4 py-2">
                  Contacts
                </h3>
                {filteredContacts.map((contact) => (
                  <ContactItem
                    key={contact.email}
                    contact={contact}
                    isSelected={
                      selectedGroupId === null &&
                      contact.email === selectedContact
                    }
                    onClick={() => {
                      setSelectedGroupId(null);
                      onSelectContact(contact.email);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}