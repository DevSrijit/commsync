"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Users, RotateCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEmailStore } from "@/lib/email-store";
import { ContactItem } from "@/components/contact-item";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Group, Email } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { MessageCategory } from "@/components/sidebar";
import { useToast } from "@/hooks/use-toast";

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
  const { contacts, emails, activeFilter, groups, setEmails } = useEmailStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [smsCount, setSmsCount] = useState<number>(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [noMoreMessages, setNoMoreMessages] = useState(false);
  const [deletedContacts, setDeletedContacts] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const { toast } = useToast();

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

  // Sort SMS contacts by the most recent message date
  const sortedSMSContacts = [...smsContacts].sort((a, b) => {
    const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
    const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
    return dateB - dateA; // Newest first
  });

  // Add effect to log diagnostic information
  useEffect(() => {
    const isSMSMessage = (email: Email) =>
      email.accountType === 'twilio' ||
      email.accountType === 'justcall' ||
      (email.labels && email.labels.includes('SMS'));

    // Count SMS messages
    const smsMessages = emails.filter(isSMSMessage);
    setSmsCount(smsMessages.length);

    if (smsMessages.length > 0) {
      // Log some details about the first few SMS messages
      const sampleSize = Math.min(3, smsMessages.length);
      console.log(`Sample of ${sampleSize} SMS messages:`);
      smsMessages.slice(0, sampleSize).forEach((msg, i) => {
        // Use type assertion to access justcallTimes
        const justcallTimesStr = (msg as any).justcallTimes
          ? JSON.stringify((msg as any).justcallTimes)
          : 'N/A';

        console.log(`SMS #${i + 1}: 
  - id: ${msg.id}
  - from: ${msg.from.name} (${msg.from.email}) 
  - accountType: ${msg.accountType}
  - labels: ${msg.labels?.join(', ')}
  - date: ${msg.date}
  - justcallTimes: ${justcallTimesStr}
  - has body: ${Boolean(msg.body)}`);
      });

      // Log sorted SMS contacts
      if (smsContacts.length > 0) {
        console.log(`Top 3 SMS contacts by lastMessageDate:`);
        sortedSMSContacts.slice(0, 3).forEach((contact, i) => {
          console.log(`Contact #${i + 1}: ${contact.name} (${contact.email}), lastMessageDate: ${contact.lastMessageDate}`);
        });
      }
    }
  }, [emails, activeFilter, contacts, sortedSMSContacts, smsContacts]);

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
      // Sort by date
      .sort((a, b) => {
        const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
        const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
        return dateB - dateA; // Newest first
      })
    : [];

  const filteredContacts = contacts.filter((contact) => {
    // First filter by search query
    const matchesSearch =
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Skip contacts that are the user's own Gmail address and likely error placeholders
    if (session?.user?.email && contact.email === session.user.email && 
        contact.accountType !== 'imap' && !contact.accountId) {
      return false;
    }

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
      case "contacts":
        // When on contacts filter, we don't show individual contacts
        return false;
      default:
        return true;
    }
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleGroupSelect = (group: Group) => {
    setSelectedGroupId(group.id);
    onSelectContact(`group:${group.id}`, true, group.id);
  };

  // Only show SMS contacts when SMS filter is active
  const displayedContacts = activeFilter === 'sms'
    ? [...sortedSMSContacts, ...syntheticSMSContacts]
    : activeFilter === 'contacts'
      ? [] // Show no regular contacts when on contacts filter
      : filteredContacts;

  const handleDeleteContact = (contactEmail: string) => {
    // Add to deleted contacts array so it's filtered from UI immediately
    setDeletedContacts(prev => [...prev, contactEmail]);
    
    // If this was the selected contact, deselect it
    if (selectedContact === contactEmail) {
      onSelectContact(null);
    }
  };

  // Filter out deleted contacts from displayed contacts
  const visibleContacts = displayedContacts.filter(
    contact => !deletedContacts.includes(contact.email)
  );

  const GroupItem = ({ group, isSelected, onClick }: {
    group: Group;
    isSelected: boolean;
    onClick: () => void;
  }) => {
    return (
      <div
        className={cn(
          "p-4 cursor-pointer hover:bg-accent/50 rounded-lg border m-2",
          isSelected && "bg-accent"
        )}
        onClick={onClick}
      >
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center">
            <Users className="h-4 w-4 mr-2 text-muted-foreground" />
            <h3 className="font-medium">{group.name}</h3>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {group.addresses.length > 0 && (
            <p>{group.addresses.length} email{group.addresses.length !== 1 ? 's' : ''}</p>
          )}
          {group.phoneNumbers.length > 0 && (
            <p>{group.phoneNumbers.length} phone number{group.phoneNumbers.length !== 1 ? 's' : ''}</p>
          )}
          <p>{group.addresses.length + group.phoneNumbers.length} total contact{group.addresses.length + group.phoneNumbers.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
    );
  };

  // Function to load more messages
  const loadMoreMessages = useCallback(async () => {
    try {
      setIsLoadingMore(true);
      setNoMoreMessages(false); // Reset no more messages state when loading starts

      // Get the current store state
      const store = useEmailStore.getState();

      const initialEmailCount = store.emails.length;
      const initialCursor = store.lastJustcallMessageId;

      console.log('Loading more messages...');
      console.log('Current pagination state:');
      console.log('- IMAP page:', store.currentImapPage);
      console.log('- Twilio page:', store.currentTwilioPage);
      console.log('- JustCall cursor (lastMessageId):', store.lastJustcallMessageId || 'none');

      // Track which services returned new messages
      const results = await Promise.all([
        store.syncImapAccounts().then(count => ({ service: 'IMAP', count })),
        store.syncTwilioAccounts().then(count => ({ service: 'Twilio', count })),
        store.syncJustcallAccounts(true).then(count => ({ service: 'JustCall', count }))
      ]);

      // Check if we got new emails
      const newStore = useEmailStore.getState();
      const newEmailCount = newStore.emails.length;
      const messagesLoaded = newEmailCount - initialEmailCount;
      
      // Check if JustCall cursor changed
      if (initialCursor !== newStore.lastJustcallMessageId) {
        console.log('JustCall cursor updated:', 
          `${initialCursor || 'none'} → ${newStore.lastJustcallMessageId || 'none'}`);
      } else if (newStore.lastJustcallMessageId) {
        console.warn('JustCall cursor did not update! Still using:', newStore.lastJustcallMessageId);
      }

      // Log results by service
      results.forEach(result => {
        if (result.count !== undefined) {
          console.log(`${result.service} loaded ${result.count} new messages`);
        }
      });

      console.log(`Total: Loaded ${messagesLoaded} new messages`);

      // We'll consider "no more messages" only if all services return no new messages
      if (messagesLoaded === 0) {
        // Increment our count of empty loads
        const emptyLoadCount = (parseInt(localStorage.getItem('emptyLoadCount') || '0')) + 1;
        localStorage.setItem('emptyLoadCount', emptyLoadCount.toString());

        console.log(`No new messages found (attempt ${emptyLoadCount} of 3)`);

        // After three consecutive empty loads, we can assume there are no more messages
        if (emptyLoadCount >= 3) {
          console.log('No more messages to load after 3 attempts.');
          setNoMoreMessages(true);

          // Reset the "No more messages" state after 3 seconds
          setTimeout(() => {
            setNoMoreMessages(false);
            localStorage.setItem('emptyLoadCount', '0');
            
            // For JustCall, we don't need to reset anything as we use cursor-based pagination
            // The lastJustcallMessageId will be automatically updated as new messages come in
          }, 3000);
        }
      } else {
        // Reset the counter if we got new messages
        localStorage.setItem('emptyLoadCount', '0');
        setNoMoreMessages(false);
      }

      setIsLoadingMore(false);
    } catch (error) {
      console.error("Error loading more messages:", error);
      setIsLoadingMore(false);
      // Show error briefly then allow retry
      setTimeout(() => {
        setNoMoreMessages(false);
      }, 3000);
    }
  }, []);

  if (isLoading) {
    return (
      <div className={cn("flex flex-col h-full p-4", className)}>
        <div className="px-2 py-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
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
      ref={containerRef}
    >
      <div className="sticky top-0 z-10 px-2 py-4 bg-background">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
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
            ) : activeFilter === 'contacts' ? (
              <>
                <p>No contact groups found.</p>
                <p className="text-xs mt-1">Add contact groups from the sidebar menu.</p>
              </>
            ) : (
              <p>No conversations found.</p>
            )}
          </div>
        ) : (
          <>
            {/* Show groups first */}
            {groups.length > 0 && activeFilter !== 'sms' && (
              <div className="px-3 mb-2">
                <h2 className="text-sm font-medium text-muted-foreground mb-2">
                  {activeFilter === 'contacts' ? 'Contact Groups' : 'Contacts'}
                </h2>
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
            {displayedContacts.length > 0 && activeFilter !== 'contacts' && (
              <div className="px-3">
                <h2 className="text-sm font-medium text-muted-foreground mb-2">
                  {activeFilter === 'sms' ? 'SMS Conversations' : 'Conversations'}
                </h2>
                <div>
                  {visibleContacts.map((contact) => (
                    <ContactItem
                      key={contact.email}
                      contact={contact}
                      isSelected={selectedContact === contact.email}
                      onClick={() => onSelectContact(contact.email)}
                      onDelete={handleDeleteContact}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Load More button */}
            <div className="p-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="w-full flex items-center justify-center gap-2"
                onClick={loadMoreMessages}
                disabled={isLoadingMore || noMoreMessages}
              >
                {isLoadingMore ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" />
                    <span>Loading more...</span>
                  </>
                ) : noMoreMessages ? (
                  <span>No more messages</span>
                ) : (
                  <>
                    <RotateCw className="h-4 w-4" />
                    <span>Load more messages</span>
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
