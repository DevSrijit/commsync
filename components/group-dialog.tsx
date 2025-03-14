"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useEmailStore } from "@/lib/email-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Email } from "@/lib/types";

interface Group {
  id: string;
  name: string;
  addresses: string[];
}

interface EmailStoreWithGroups {
  emails: Email[];
  addGroup: (group: Group) => void;
  updateGroup: (group: Group) => void;
}

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupToEdit?: {
    id: string;
    name: string;
    addresses: string[];
  };
}

export default function GroupDialog({ open, onOpenChange, groupToEdit }: GroupDialogProps) {
  const { toast } = useToast();
  const { emails, addGroup, updateGroup } = useEmailStore() as EmailStoreWithGroups;

  const [groupName, setGroupName] = useState("");
  const [addresses, setAddresses] = useState<string[]>([]);
  const [newAddress, setNewAddress] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // Initialize form when editing an existing group
  useEffect(() => {
    if (groupToEdit) {
      setGroupName(groupToEdit.name);
      setAddresses(groupToEdit.addresses);
      setIsEditing(true);
    } else {
      setGroupName("");
      setAddresses([]);
      setIsEditing(false);
    }
  }, [groupToEdit, open]);

  // Generate email suggestions based on existing emails
  useEffect(() => {
    if (newAddress.length > 2) {
      // Extract unique email addresses from emails
      const allEmails = new Set<string>();

      emails.forEach(email => {
        // Add from addresses
        if (email.from) {
          const fromEmail = email.from.email;
          if (fromEmail && fromEmail.includes('@')) {
            allEmails.add(fromEmail);
          }
        }

        // Add to addresses
        if (email.to) {
          email.to.forEach(recipient => {
            const toEmail = recipient.email;
            if (toEmail && toEmail.includes('@')) {
              allEmails.add(toEmail);
            }
          });
        }
      });

      // Filter suggestions based on input
      const filtered = Array.from(allEmails)
        .filter(email =>
          email.toLowerCase().includes(newAddress.toLowerCase()) &&
          !addresses.includes(email)
        )
        .slice(0, 5);

      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [newAddress, emails, addresses]);

  const handleAddAddress = () => {
    if (newAddress && newAddress.includes('@') && !addresses.includes(newAddress)) {
      setAddresses([...addresses, newAddress]);
      setNewAddress("");
    }
  };

  const handleRemoveAddress = (address: string) => {
    setAddresses(addresses.filter(a => a !== address));
  };

  const handleSelectSuggestion = (suggestion: string) => {
    if (!addresses.includes(suggestion)) {
      setAddresses([...addresses, suggestion]);
      setNewAddress("");
      setSuggestions([]);
    }
  };

  const handleSubmit = () => {
    if (!groupName.trim()) {
      toast({
        title: "Group name required",
        description: "Please enter a name for this group",
        variant: "destructive",
      });
      return;
    }

    if (addresses.length === 0) {
      toast({
        title: "Addresses required",
        description: "Please add at least one email address to the group",
        variant: "destructive",
      });
      return;
    }

    if (isEditing && groupToEdit) {
      updateGroup({
        id: groupToEdit.id,
        name: groupName,
        addresses,
      });
      toast({
        title: "Group updated",
        description: `Group "${groupName}" has been updated`,
      });
    } else {
      addGroup({
        id: crypto.randomUUID(),
        name: groupName,
        addresses,
      });
      toast({
        title: "Group created",
        description: `Group "${groupName}" has been created`,
      });
    }

    // Reset form and close dialog
    setGroupName("");
    setAddresses([]);
    setNewAddress("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-medium">
            {isEditing ? "Edit Group" : "Create New Group"}
          </DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-address">Email Addresses</Label>
            <div className="flex gap-2">
              <Input
                id="email-address"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Add email address"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAddress();
                  }
                }}
              />
              <Button onClick={handleAddAddress} type="button">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="mt-1 border rounded-md overflow-hidden">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={() => handleSelectSuggestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* List of added addresses */}
            {addresses.length > 0 && (
              <ScrollArea className="h-[150px] border rounded-md p-2">
                <div className="space-y-2">
                  {addresses.map((address) => (
                    <div
                      key={address}
                      className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 p-2 rounded-md"
                    >
                      <span className="text-sm truncate">{address}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveAddress(address)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="px-4 py-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing ? "Update Group" : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}