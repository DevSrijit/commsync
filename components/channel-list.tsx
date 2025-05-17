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
import {
  isGroupChat,
  createWhatsAppContactKey,
  cleanPhoneNumber
} from "@/lib/whatsapp-utils";

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

  // Use our enhanced WhatsApp utilities to deduplicate contacts
  const deduplicatedContacts = useMemo(() => {
    const uniqueContactsMap = new Map<string, Contact>();
    contacts.forEach(contact => {
      // Create unique key based on contact email and account type
      let key = contact.email.toLowerCase();

      // Special handling for WhatsApp contacts to prevent duplicates
      if (contact.accountType === "whatsapp") {
        if (contact.email.endsWith('@g.us')) {
          // For WhatsApp groups, use a special key format
          key = `whatsapp:group:${contact.email}`;
        } else {
          // For regular WhatsApp contacts, clean the phone number
          key = `whatsapp:contact:${cleanPhoneNumber(contact.email)}`;
        }
      }

      // If we already have this contact, keep the one with the more recent message
      const existingContact = uniqueContactsMap.get(key);
      if (!existingContact ||
        (contact.lastMessageDate && existingContact.lastMessageDate &&
          new Date(contact.lastMessageDate) > new Date(existingContact.lastMessageDate))) {
        uniqueContactsMap.set(key, contact);
      }
    });

    // Convert map to array and sort by last message date
    return Array.from(uniqueContactsMap.values()).sort((a, b) => {
      const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
      const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
      return dateB - dateA; // Newest first
    });
  }, [contacts]);

  // Use deduplicatedContacts in place of contacts
  const filteredContacts = useMemo(() => {
    if (!activeFilter) {
      return deduplicatedContacts;
    }

    // Filter contacts based on activeFilter
    if (activeFilter === 'sms') {
      return deduplicatedContacts.filter(contact =>
        contact.labels?.some(label =>
          label.toLowerCase() === 'sms' ||
          label.toLowerCase() === 'twilio' ||
          label.toLowerCase() === 'justcall' ||
          label.toLowerCase() === 'bulkvs' ||
          label.toLowerCase() === 'whatsapp'
        ) ||
        contact.accountType === 'twilio' ||
        contact.accountType === 'justcall' ||
        contact.accountType === 'bulkvs' ||
        contact.accountType === 'whatsapp'
      );
    } else if (activeFilter === 'inbox') {
      return deduplicatedContacts.filter(contact =>
        !contact.labels?.includes('SENT') &&
        !contact.labels?.includes('TRASH')
      );
    } else if (activeFilter.startsWith('group:')) {
      // Handle group filtering (if needed)
      return deduplicatedContacts;
    } else if (searchQuery.trim()) {
      // When searching, use the search results
      return deduplicatedContacts.filter(contact =>
        searchResults.matches.has(contact.email)
      );
    }

    // Default case - return all deduplicatedContacts
    return deduplicatedContacts;
  }, [activeFilter, searchQuery, deduplicatedContacts, searchResults.matches]);

  // Add missing variables
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const contactsByGroupId = useMemo(() => {
    // Create a map of group ID to contacts
    const groupMap = new Map<string, Contact[]>();
    return groupMap;
  }, []);

  // Setup pagination
  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.max(1, Math.ceil((filteredContacts?.length || 0) / ITEMS_PER_PAGE));
  const isLastPage = currentPage === totalPages;

  // Function to load more messages
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || noMoreMessages) return;

    setIsLoadingMore(true);
    try {
      // Use the session from the state
      if (session && session.user?.accessToken) {
        const token = session.user.accessToken;
        // Call syncAllPlatforms but don't check the return value
        await useEmailStore.getState().syncAllPlatforms(token);

        // Check if we have new emails by comparing with previous count
        const previousCount = emails.length;
        const currentCount = useEmailStore.getState().emails.length;

        if (currentCount > previousCount) {
          toast({
            title: "Messages updated",
            description: "Loaded additional messages",
          });
        } else {
          setNoMoreMessages(true);
        }
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
      toast({
        title: "Failed to load more",
        description: "Could not load additional messages",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, noMoreMessages, toast, emails.length, session]);

  // Update handleContactSelect function to handle WhatsApp groups
  const handleContactSelect = (contactEmail: string) => {
    // Check if this is a WhatsApp group by looking at the email address
    const isWhatsAppGroup = contactEmail.endsWith('@g.us');

    if (isWhatsAppGroup) {
      // For WhatsApp groups, pass the isGroup and groupId parameters
      onSelectContact(contactEmail, true, contactEmail);
    } else {
      // Regular contact selection
      onSelectContact(contactEmail);
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
        {(filteredContacts?.length === 0) && groups.length === 0 ? (
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
              {groups.length > 0 && activeFilter !== 'sms' && (
                <div className="px-3 mb-2">
                  <div className="flex items-center justify-between px-2 py-3">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      {activeFilter === 'contacts' ? 'Contact Groups' : 'Contacts'}
                    </h2>
                    <Button
                      onClick={() => {
                        setGroupToEdit(undefined);
                        setIsGroupDialogOpen(true);
                      }}
                      variant="outline"
                      size="sm"
                      className="h-8 flex items-center gap-1"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>New Group</span>
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {groups.map(group => (
                      <div
                        key={group.id}
                        className={cn(
                          "p-3 cursor-pointer hover:bg-accent/50 rounded-lg border m-2 transition-colors relative group",
                          selectedGroupId === group.id && "bg-accent border-primary/20"
                        )}
                        onClick={() => {
                          setSelectedGroupId(group.id);
                          onSelectContact(`group:${group.id}`, true, group.id);
                        }}
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
                              setGroupToEdit(group);
                              setIsGroupDialogOpen(true);
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
                              setSelectedGroupId(null);
                              onSelectContact('');
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Show empty group section with new group button if on contacts filter */}
              {activeFilter === 'contacts' && groups.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <h2 className="text-base font-medium mb-4">
                    No contact groups yet
                  </h2>
                  <Button
                    onClick={() => {
                      setGroupToEdit(undefined);
                      setIsGroupDialogOpen(true);
                    }}
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
              {filteredContacts?.length > 0 && activeFilter !== 'contacts' && (
                <div className="px-3">
                  <h2 className="text-sm font-medium text-muted-foreground px-2 py-3">
                    {activeFilter === 'sms' ? 'SMS Conversations' : 'Conversations'}
                  </h2>
                  <div className="space-y-1">
                    {filteredContacts?.map((contact) => (
                      <div
                        key={contact.email}
                        className="touch-manipulation"  // Optimize for touch
                      >
                        <ContactItem
                          contact={contact}
                          isSelected={selectedContact === contact.email}
                          onClick={() => handleContactSelect(contact.email)}
                          onDelete={(contactEmail) => {
                            setDeletedContacts(prev => [...prev, contactEmail]);
                            if (selectedContact === contactEmail) {
                              onSelectContact('');
                            }
                          }}
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
              {(groups.length > 0 || filteredContacts?.length > 0) && totalPages > 1 && (
                <div className="px-2 py-2">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(pageNumber) => {
                      setCurrentPage(pageNumber);
                      // Scroll to top of list when changing pages
                      if (containerRef.current) {
                        containerRef.current.scrollTop = 0;
                      }
                    }}
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
