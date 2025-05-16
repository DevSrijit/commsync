"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, Users, RotateCw, ChevronLeft, ChevronRight, Command, X, PanelLeft, Mail, MessageSquare, Pencil, Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEmailStore } from "@/lib/email-store";
import { ContactItem } from "@/components/contact-item";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Group, Email, Contact } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { MessageCategory } from "@/components/sidebar";
import { useToast } from "@/hooks/use-toast";
import Fuse from 'fuse.js';
import Highlighter from 'react-highlight-words';
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import GroupDialog from "@/components/group-dialog";

// Pagination component with Apple-inspired design
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) => {
  // Calculate which page numbers to show (show 5 pages at most)
  const getPageNumbers = () => {
    const pageNumbers = [];
    // For small number of pages, show all
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // For many pages, show current page and neighbors
      if (currentPage <= 3) {
        // Show first 5 pages
        for (let i = 1; i <= 5; i++) {
          pageNumbers.push(i);
        }
      } else if (currentPage >= totalPages - 2) {
        // Show last 5 pages
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        // Show current page and 2 neighbors on each side
        for (let i = currentPage - 2; i <= currentPage + 2; i++) {
          pageNumbers.push(i);
        }
      }
    }
    return pageNumbers;
  };

  return (
    <div className="flex items-center justify-center gap-1 py-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Previous page</span>
      </Button>

      {getPageNumbers().map(page => (
        <Button
          key={page}
          variant={currentPage === page ? "default" : "ghost"}
          size="sm"
          className={cn(
            "h-8 w-8 rounded-full px-0",
            currentPage === page && "bg-primary text-primary-foreground font-medium"
          )}
          onClick={() => onPageChange(page)}
        >
          {page}
        </Button>
      ))}

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Next page</span>
      </Button>
    </div>
  );
};

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
  const { toast } = useToast();
  const { data: session } = useSession();

  // Group management state
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<Group | undefined>(undefined);

  // Debug log to trace the issue
  useEffect(() => {
    console.log(`EmailList re-render:
    - activeFilter: ${activeFilter}
    - contacts: ${contacts.length}
    - emails: ${emails.length}
    - isLoading: ${isLoading}`);
  }, [activeFilter, contacts.length, emails.length, isLoading]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [smsCount, setSmsCount] = useState<number>(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [noMoreMessages, setNoMoreMessages] = useState(false);
  const [deletedContacts, setDeletedContacts] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search results
  const [searchResults, setSearchResults] = useState({
    contacts: contacts,
    emails: emails,
    matches: new Set<string>(),
    rankedResults: contacts
  });

  // Update searchResults when contacts or emails change
  useEffect(() => {
    if (contacts.length > 0 || emails.length > 0) {
      setSearchResults({
        contacts: contacts,
        emails: emails,
        matches: new Set<string>(),
        rankedResults: contacts
      });
    }
  }, [contacts, emails]);

  // Fallback client-side search function
  const performClientSearch = useCallback((query: string) => {
    if (!query.trim()) {
      return {
        contacts: contacts,
        emails: emails,
        matches: new Set<string>(),
        rankedResults: contacts
      };
    }

    // Simple text-based search as fallback
    const searchTerms = query.toLowerCase().split(/\s+/);

    const matchedContacts = contacts.filter(contact => {
      const searchableText = [
        contact.name,
        contact.email,
        contact.lastMessageSubject
      ].join(' ').toLowerCase();

      return searchTerms.every(term => searchableText.includes(term));
    });

    return {
      contacts: matchedContacts,
      emails: emails.filter(email =>
        searchTerms.every(term =>
          email.subject.toLowerCase().includes(term) ||
          email.body.toLowerCase().includes(term)
        )
      ),
      matches: new Set(matchedContacts.map(c => c.email)),
      rankedResults: matchedContacts
    };
  }, [contacts, emails]);

  // Memoize the search input handler
  const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    if (value.trim()) {
      setShowSearchPopup(true);
    } else {
      setShowSearchPopup(false);
      setSearchQuery("");
      setSearchResults({
        contacts: contacts,
        emails: emails,
        matches: new Set<string>(),
        rankedResults: contacts
      });
    }
  }, [contacts, emails]);

  // Add clear search function
  const clearSearch = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setShowSearchPopup(false);
    setSearchResults({
      contacts: contacts,
      emails: emails,
      matches: new Set<string>(),
      rankedResults: contacts
    });
  }, [contacts, emails]);

  // Handle search submission
  const handleSearchSubmit = useCallback(async () => {
    if (!searchInput.trim()) {
      setShowSearchPopup(false);
      return;
    }

    setSearchQuery(searchInput);
    setCurrentPage(1);
    setIsSearching(true);
    setShowSearchPopup(false);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchInput,
          contacts,
          emails
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const results = await response.json();

      setSearchResults({
        ...results,
        matches: new Set(results.matches),
        rankedResults: results.rankedResults.map((contact: Contact) => ({
          ...contact,
          matchedFields: new Set(contact.matchedFields)
        }))
      });
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Error",
        description: "Failed to perform search. Falling back to client-side search.",
        variant: "destructive",
      });

      const results = performClientSearch(searchInput);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  }, [searchInput, contacts, emails, toast, performClientSearch]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    } else if (e.key === 'Escape') {
      setShowSearchPopup(false);
      setSearchInput("");
    }
  }, [handleSearchSubmit]);

  // Enhanced contact filtering with ranking
  const filteredContacts = useMemo(() => {
    // Ensure we have valid ranked results, fall back to contacts if not
    const rankedResults = searchResults.rankedResults?.length ? searchResults.rankedResults : contacts;

    const filteredResults = rankedResults.filter((contact) => {
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
            email.accountType === 'bulkvs' ||
            (email.labels && email.labels.includes("SMS")))
          );
        case "contacts":
          return false;
        default:
          return true;
      }
    });

    // If we're in inbox mode and no contacts match the criteria but we have emails,
    // show all contacts instead of an empty list (fallback for first load)
    if (activeFilter === 'inbox' && rankedResults.length > 0 && emails.length > 0 && filteredResults.length === 0) {
      console.log("No contacts match inbox filter criteria - showing all contacts as fallback");
      return rankedResults;
    }

    return filteredResults;
  }, [searchResults.rankedResults, session?.user?.email, emails, activeFilter, contacts]);

  // Reset to page 1 when activeFilter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  // Add loading state check for when contacts and emails are initially empty but loading
  useEffect(() => {
    // If we have contacts or emails but we're still marked as loading, complete loading
    if ((contacts.length > 0 || emails.length > 0) && isLoading) {
      // We can't directly modify isLoading since it's a prop, but we can log to help debug
      console.log("Data loaded: contacts:", contacts.length, "emails:", emails.length);
    }
  }, [contacts, emails, isLoading]);

  // Improved SMS contact detection
  const isSMSMessage = (email: Email) =>
    email.accountType === 'twilio' ||
    email.accountType === 'justcall' ||
    email.accountType === 'bulkvs' ||
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
      email.accountType === 'bulkvs' ||
      (email.labels && email.labels.includes('SMS'));

    // Count SMS messages
    const smsMessages = emails.filter(isSMSMessage);
    setSmsCount(smsMessages.length);

    if (smsMessages.length > 0) {
      // Log some details about the first few SMS messages
      const sampleSize = Math.min(3, smsMessages.length);
      //console.log(`Sample of ${sampleSize} SMS messages:`);
      smsMessages.slice(0, sampleSize).forEach((msg, i) => {
        // Use type assertion to access justcallTimes
        const justcallTimesStr = (msg as any).justcallTimes
          ? JSON.stringify((msg as any).justcallTimes)
          : 'N/A';

        //console.log(`SMS #${i + 1}: 
        //- id: ${msg.id}
        //- from: ${msg.from.name} (${msg.from.email}) 
        //- accountType: ${msg.accountType}
        //- labels: ${msg.labels?.join(', ')}
        //- date: ${msg.date}
        //- justcallTimes: ${justcallTimesStr}
        //- has body: ${Boolean(msg.body)}`);
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
        accountType: email.accountType,
        searchScore: 0,
        matchedFields: new Set<string>()
      } as Contact))
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

  // Only show SMS contacts when SMS filter is active
  const displayedContacts = activeFilter === 'sms'
    ? [...sortedSMSContacts, ...syntheticSMSContacts]
    : activeFilter === 'contacts'
      ? [] // Show no regular contacts when on contacts filter
      : filteredContacts;

  // Debug log when we have contacts but no displayed contacts
  useEffect(() => {
    if (contacts.length > 0 &&
      activeFilter !== 'sms' &&
      activeFilter !== 'contacts' &&
      filteredContacts.length === 0) {
      console.warn(`Potential issue: We have ${contacts.length} contacts, but filteredContacts is empty. 
      Active filter: ${activeFilter}. 
      SearchResults has ${searchResults.rankedResults?.length || 0} ranked results.`);
    }
  }, [contacts.length, filteredContacts.length, activeFilter, searchResults.rankedResults?.length]);

  const handleGroupSelect = (group: Group) => {
    setSelectedGroupId(group.id);
    onSelectContact(`group:${group.id}`, true, group.id);
  };

  const handleDeleteContact = (contactEmail: string) => {
    // Add to deleted contacts array so it's filtered from UI immediately
    setDeletedContacts(prev => [...prev, contactEmail]);

    // If this was the selected contact, deselect it
    if (selectedContact === contactEmail) {
      onSelectContact(''); // Use empty string instead of null
    }
  };

  // Filter out deleted contacts from displayed contacts
  const visibleContacts = displayedContacts.filter(
    contact => !deletedContacts.includes(contact.email)
  );

  // Pagination calculations
  const totalContactPages = Math.max(1, Math.ceil(visibleContacts.length / itemsPerPage));
  const totalGroupPages = Math.max(1, Math.ceil(groups.length / itemsPerPage));
  const totalPages = activeFilter === 'contacts' ? totalGroupPages : totalContactPages;

  // Get current page items
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentContacts = visibleContacts.slice(indexOfFirstItem, indexOfLastItem);
  const currentGroups = groups.slice(indexOfFirstItem, indexOfLastItem);

  // Handle page change
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    // Scroll to top of list when changing pages
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  };

  // Determine if we're on the last page
  const isLastPage = currentPage === totalPages;

  const GroupItem = ({ group, isSelected, onClick, onEdit, onDelete }: {
    group: Group;
    isSelected: boolean;
    onClick: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }) => {
    return (
      <div
        className={cn(
          "p-3 cursor-pointer hover:bg-accent/50 rounded-lg border m-2 transition-colors relative group",
          isSelected && "bg-accent border-primary/20"
        )}
        onClick={onClick}
      >
        <div className="flex gap-3 items-center">
          <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center font-medium flex-shrink-0">
            {group.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">{group.name}</span>
              <Badge variant="outline" className="text-xs">
                {group.addresses.length + group.phoneNumbers.length} contacts
              </Badge>
            </div>
            <div className="flex -space-x-2 mt-1.5">
              {/* Show avatars for first few addresses */}
              {Array(Math.min(4, Math.max(group.addresses.length, group.phoneNumbers.length))).fill(0).map((_, j) => (
                <Avatar key={j} className="h-5 w-5 ring-2 ring-background">
                  <AvatarFallback className="text-[10px]">
                    {group.addresses[j]?.charAt(0).toUpperCase() ||
                      group.phoneNumbers[j]?.charAt(0).toUpperCase() ||
                      String.fromCharCode(65 + j % 26)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {/* Show +X more if there are additional contacts */}
              {(group.addresses.length + group.phoneNumbers.length) > 4 && (
                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] ring-2 ring-background">
                  +{(group.addresses.length + group.phoneNumbers.length) - 4}
                </div>
              )}
            </div>
            <div className="flex text-xs text-muted-foreground mt-2 gap-2">
              {group.addresses.length > 0 && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {group.addresses.length}
                </span>
              )}
              {group.phoneNumbers.length > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {group.phoneNumbers.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-red-500/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
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

      // Get the user's configured page size
      const pageSize = store.loadPageSize || 100;
      console.log(`Loading more messages with pageSize: ${pageSize}`);

      const initialEmailCount = store.emails.length;
      // Get the JustCall message ID map for tracking changes
      const initialJustcallCursors = store.lastJustcallMessageIds;

      console.log('Loading more messages...');
      console.log('Current pagination state:');
      console.log('- IMAP page:', store.currentImapPage);
      console.log('- Twilio page:', store.currentTwilioPage);
      console.log('- JustCall cursors:', Object.keys(initialJustcallCursors).length > 0
        ? Object.entries(initialJustcallCursors).map(([id, cursor]) => `Account ${id}: ${cursor}`).join(', ')
        : 'none');
      console.log('- Page size:', pageSize);

      // Find the oldest Gmail email to use for filtering
      const gmailEmails = store.emails.filter(email =>
        !email.accountId || email.accountType === 'gmail' || email.source === 'gmail-api'
      );

      let oldestGmailEmail = null;
      if (gmailEmails.length > 0) {
        // Sort by date ascending to find oldest
        const sortedGmailEmails = [...gmailEmails].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        oldestGmailEmail = sortedGmailEmails[0];
        console.log('Oldest Gmail email date:', oldestGmailEmail.date);
        console.log('Oldest Gmail email subject:', oldestGmailEmail.subject);
      } else {
        console.log('No Gmail emails found to establish pagination reference');
      }

      // Track which services returned new messages
      const results = await Promise.all([
        // For Gmail, we'll pass the oldest email date for backwards loading
        oldestGmailEmail
          ? store.syncEmails(session?.user?.accessToken || '', {
            isLoadingMore: true,
            oldestEmailDate: oldestGmailEmail.date
          })
          : store.syncEmails(session?.user?.accessToken || ''),
        store.syncImapAccounts(),
        store.syncTwilioAccounts(),
        store.syncJustcallAccounts(true)
      ]);

      // Check if we got new emails
      const newStore = useEmailStore.getState();
      const newEmailCount = newStore.emails.length;
      const messagesLoaded = newEmailCount - initialEmailCount;

      // Check if JustCall cursors changed
      const newJustcallCursors = newStore.lastJustcallMessageIds;
      const cursorChanges = Object.keys(newJustcallCursors).filter(accountId =>
        newJustcallCursors[accountId] !== (initialJustcallCursors[accountId] || null)
      );

      if (cursorChanges.length > 0) {
        console.log(`JustCall cursors updated for ${cursorChanges.length} accounts:`);
        cursorChanges.forEach(accountId => {
          console.log(`- Account ${accountId}: ${initialJustcallCursors[accountId] || 'none'} → ${newJustcallCursors[accountId]}`);
        });
      } else if (Object.keys(newJustcallCursors).length > 0) {
        console.warn('JustCall cursors did not update! Still using the same cursors');
      }

      // Log results by service
      results.forEach((result, index) => {
        const serviceName = ['Gmail', 'IMAP', 'Twilio', 'JustCall'][index];
        if (result !== undefined) {
          console.log(`${serviceName} loaded ${result} new messages`);

          // Check if this was a rate-limited result for JustCall
          if (index === 3 && typeof result === 'object') {
            // Type assertion for JustCall result
            const justcallResult = result as {
              rateLimited?: boolean;
              retryAfter?: number;
            };

            if (justcallResult.rateLimited) {
              // Show rate limit warning to the user
              toast({
                title: "JustCall API Rate Limit",
                description: justcallResult.retryAfter
                  ? `Rate limit reached. Try again in ${justcallResult.retryAfter} seconds.`
                  : "Rate limit approaching. Try a smaller batch size.",
                variant: "destructive",
                duration: 5000
              });
            }
          }
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

            // The lastJustcallMessageIds map will be automatically updated for each account as new messages come in
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

      // Show error toast
      toast({
        title: "Error Loading Messages",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
        duration: 5000
      });

      // Show error briefly then allow retry
      setTimeout(() => {
        setNoMoreMessages(false);
      }, 3000);
    }
  }, [toast, session]);

  // Group management handlers
  const handleCreateGroup = () => {
    setGroupToEdit(undefined);
    setIsGroupDialogOpen(true);
  };

  const handleEditGroup = (group: Group) => {
    setGroupToEdit(group);
    setIsGroupDialogOpen(true);
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await useEmailStore.getState().deleteGroup(groupId);
      toast({
        title: "Group deleted",
        description: "The group has been deleted successfully",
      });
      // If this was the selected group, deselect it
      if (selectedGroupId === groupId) {
        setSelectedGroupId(null);
        onSelectContact('');
      }
    } catch (error) {
      console.error("Error deleting group:", error);
      toast({
        title: "Error",
        description: "Failed to delete group. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex flex-col h-full p-4", className)}>
        <div className="px-2 py-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="h-9 pl-8"
              value={searchInput}
              onChange={handleSearchInputChange}
              onKeyDown={handleKeyPress}
              disabled={isSearching}
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
        "flex flex-col h-full overflow-hidden",
        className
      )}
      ref={containerRef}
    >
      {/* Search Header - Made sticky and mobile friendly */}
      <div className="sticky top-0 z-10 px-4 py-3 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-2">
          {/* Sidebar Trigger Button - Apple Style */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 md:hidden rounded-full flex items-center justify-center"
            onClick={() => {
              // Dispatch a custom event to toggle the sidebar
              const event = new CustomEvent('toggle-sidebar', { bubbles: true });
              document.dispatchEvent(event);
            }}
            aria-label="Menu"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>

          <div className="relative group flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              ref={searchInputRef}
              placeholder="Search conversations..."
              className="h-10 pl-9 pr-9 bg-muted/50 focus:bg-background transition-colors"
              value={searchInput}
              onChange={handleSearchInputChange}
              onKeyDown={handleKeyPress}
              disabled={isSearching}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchInput && !isSearching && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full hover:bg-accent/80 transition-all duration-200"
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                </Button>
              )}
              {isSearching && (
                <RotateCw className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showSearchPopup && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute left-0 right-0 mt-2 mx-2 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg overflow-hidden z-20"
            >
              <div className="p-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Command className="h-4 w-4" />
                    <span>Press Enter to search</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 text-xs bg-muted rounded">esc</kbd>
                    <span>to close</span>
                  </div>
                </div>
                {searchInput.trim() && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    <p>Searching across:</p>
                    <ul className="mt-1 space-y-1">
                      <li className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <span>Contact names</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span>Email addresses</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                        <span>Message subjects</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        <span>Message content</span>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto">
        {displayedContacts.length === 0 && groups.length === 0 ? (
          <div className="text-center p-6 text-muted-foreground">
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
            ) : searchQuery.trim() ? (
              <p>No conversations found matching "{searchQuery}"</p>
            ) : (
              <p>No conversations found.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto pb-2">
              {/* Show groups first - Only show header if currentGroups has items */}
              {currentGroups.length > 0 && activeFilter !== 'sms' && (
                <div className="px-3 mb-2">
                  <div className="flex items-center justify-between px-2 py-3">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      {activeFilter === 'contacts' ? 'Contact Groups' : 'Contacts'}
                    </h2>
                    <Button
                      onClick={handleCreateGroup}
                      variant="outline"
                      size="sm"
                      className="h-8 flex items-center gap-1"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>New Group</span>
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {currentGroups.map(group => (
                      <GroupItem
                        key={group.id}
                        group={group}
                        isSelected={selectedGroupId === group.id}
                        onClick={() => handleGroupSelect(group)}
                        onEdit={() => handleEditGroup(group)}
                        onDelete={() => handleDeleteGroup(group.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Show empty group section with new group button if on contacts filter */}
              {activeFilter === 'contacts' && currentGroups.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <h2 className="text-base font-medium mb-4">
                    No contact groups yet
                  </h2>
                  <Button
                    onClick={handleCreateGroup}
                    variant="outline"
                    size="sm"
                    className="h-9 flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create New Group</span>
                  </Button>
                </div>
              )}

              {/* Show contacts with enhanced mobile touch targets */}
              {currentContacts.length > 0 && activeFilter !== 'contacts' && (
                <div className="px-3">
                  <h2 className="text-sm font-medium text-muted-foreground px-2 py-3">
                    {activeFilter === 'sms' ? 'SMS Conversations' : 'Conversations'}
                  </h2>
                  <div className="space-y-1">
                    {currentContacts.map((contact) => (
                      <div
                        key={contact.email}
                        className="touch-manipulation"  // Optimize for touch
                      >
                        <ContactItem
                          contact={contact}
                          isSelected={selectedContact === contact.email}
                          onClick={() => onSelectContact(contact.email)}
                          onDelete={handleDeleteContact}
                          searchQuery={searchQuery}
                          searchMatches={searchResults.matches}
                          searchScore={contact.searchScore}
                          matchedFields={contact.matchedFields}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Fixed footer area for pagination and load more - Enhanced for mobile */}
            <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t">
              {/* Pagination controls */}
              {(groups.length > 0 || displayedContacts.length > 0) && totalPages > 1 && (
                <div className="px-2 py-2">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}

              {/* Load More button - Enhanced for mobile */}
              {isLastPage && (
                <div className="p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-10 flex items-center justify-center gap-2 rounded-lg"
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
              )}
            </div>
          </div>
        )}
      </div>

      {/* Group dialog for creating/editing groups */}
      <GroupDialog
        open={isGroupDialogOpen}
        onOpenChange={setIsGroupDialogOpen}
        groupToEdit={groupToEdit}
      />
    </div>
  );
}
