"use client";

import { useState, useEffect } from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEmailStore } from "@/lib/email-store";
import { ContactItem } from "@/components/contact-item";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MessageCategory } from "@/components/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Group, Email } from "@/lib/types";

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
  const [smsCount, setSmsCount] = useState<number>(0);

  // Add effect to log diagnostic information
  useEffect(() => {
    const isSMSMessage = (email: Email) => 
      email.accountType === 'twilio' || 
      email.accountType === 'justcall' || 
      (email.labels && email.labels.includes('SMS'));

    // Count SMS messages
    const smsMessages = emails.filter(isSMSMessage);
    setSmsCount(smsMessages.length);
    
    console.log(`Channel list filtering:
- Total emails: ${emails.length}
- SMS messages: ${smsMessages.length}
- Active filter: ${activeFilter}
- Contact count: ${contacts.length}
`);

    if (smsMessages.length > 0) {
      // Log some details about the first few SMS messages
      const sampleSize = Math.min(3, smsMessages.length);
      console.log(`Sample of ${sampleSize} SMS messages:`);
      smsMessages.slice(0, sampleSize).forEach((msg, i) => {
        console.log(`SMS #${i+1}: 
  - id: ${msg.id}
  - from: ${msg.from.name} (${msg.from.email}) 
  - accountType: ${msg.accountType}
  - labels: ${msg.labels?.join(', ')}
  - has body: ${Boolean(msg.body)}`);
      });
    }
  }, [emails, activeFilter, contacts]);

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
      case "sent":
        return contactEmails.some((email) => 
          email.labels.includes("SENT")
        );
      case "trash":
        return contactEmails.some((email) => 
          email.labels.includes("TRASH")
        );
      case "sms":
        return contactEmails.some((email) => 
          (email.accountType === 'twilio' || 
           email.accountType === 'justcall' || 
           (email.labels && email.labels.includes("SMS")))
        );
      default:
        return true;
    }
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleGroupSelect = (group: Group) => {
    setSelectedGroupId(group.id);
    onSelectContact(group.addresses.join(", "), true, group.id);
  };

  // Improved SMS contact detection
  const isSMSMessage = (email: Email) => 
    email.accountType === 'twilio' || 
    email.accountType === 'justcall' || 
    (email.labels && email.labels.includes("SMS"));

  // Get all contacts with SMS messages
  const smsContacts = contacts.filter(contact => 
    emails.some(email => {
      const isFromOrToContact = 
        email.from.email === contact.email || 
        email.to.some(to => to.email === contact.email);
        
      return isFromOrToContact && isSMSMessage(email);
    })
  );

  // If we have no SMS contacts but have SMS messages, create contact entries for them
  const syntheticSMSContacts = smsCount > 0 && smsContacts.length === 0
    ? emails
        .filter(isSMSMessage)
        .map(email => ({
          name: email.from.name || email.from.email,
          email: email.from.email,
          lastMessageDate: email.date,
          lastMessageSubject: 'SMS Message',
          labels: ['SMS'],
          accountId: email.accountId,
          accountType: email.accountType
        }))
        // Remove duplicates by email address
        .filter((contact, index, self) => 
          index === self.findIndex(c => c.email === contact.email)
        )
    : [];

  // Only show SMS contacts when SMS filter is active
  const displayedContacts = activeFilter === 'sms' 
    ? [...smsContacts, ...syntheticSMSContacts]
    : filteredContacts;

  const GroupItem = ({ group, isSelected, onClick }: {
    group: Group; 
    isSelected: boolean; 
    onClick: () => void;
  }) => {
    return (
      <div 
        className={cn(
          "flex items-center p-3 hover:bg-muted/50 rounded-lg cursor-pointer",
          isSelected && "bg-muted"
        )}
        onClick={onClick}
      >
        <div className="rounded-full h-10 w-10 flex items-center justify-center bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div className="ml-3 overflow-hidden">
          <div className="font-medium truncate">{group.name}</div>
          <div className="text-sm text-muted-foreground truncate">
            {group.addresses.length} contacts
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={cn("flex flex-col h-full p-4", className)}>
        <div className="px-2 py-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              className="h-9 pl-8"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col h-full overflow-y-auto",
        className
      )}
    >
      <div className="sticky top-0 z-10 px-2 py-4 bg-background">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            className="h-9 pl-8"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {displayedContacts.length === 0 && groups.length === 0 ? (
          <div className="text-center p-4 text-muted-foreground">
            {activeFilter === 'sms' ? (
              <>
                <p>No SMS contacts found.</p>
                {smsCount > 0 && <p className="text-xs mt-1">Found {smsCount} SMS messages, but couldn't associate with contacts.</p>}
              </>
            ) : (
              <p>No contacts found.</p>
            )}
          </div>
        ) : (
          <>
            {/* Show groups first */}
            {groups.length > 0 && activeFilter !== 'sms' && (
              <div className="px-3 mb-2">
                <h2 className="text-sm font-medium text-muted-foreground mb-2">Groups</h2>
                <div className="space-y-1">
                  {groups.map(group => (
                    <GroupItem 
                      key={group.id}
                      group={group}
                      isSelected={selectedGroupId === group.id}
                      onClick={() => handleGroupSelect(group)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Show contacts */}
            {displayedContacts.length > 0 && (
              <div className="px-3">
                <h2 className="text-sm font-medium text-muted-foreground mb-2">
                  {activeFilter === 'sms' ? 'SMS Contacts' : 'Contacts'}
                </h2>
                <div>
                  {displayedContacts.map((contact) => (
                    <ContactItem
                      key={contact.email}
                      contact={contact}
                      isSelected={selectedContact === contact.email}
                      onClick={() => onSelectContact(contact.email)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}