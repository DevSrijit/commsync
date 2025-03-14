"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Pencil } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Group {
  id: string;
  name: string;
  addresses: string[];
}

interface EmailStoreWithGroups {
  emails: Email[];
  groups: Group[];
  addGroup: (group: Group) => void;
  updateGroup: (group: Group) => void;
  deleteGroup: (groupId: string) => void;
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
  const { emails, groups, addGroup, updateGroup, deleteGroup } = useEmailStore() as EmailStoreWithGroups;

  const [activeTab, setActiveTab] = useState<string>("create");
  const [groupName, setGroupName] = useState("");
  const [addresses, setAddresses] = useState<string[]>([]);
  const [newAddress, setNewAddress] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Initialize form when editing an existing group
  useEffect(() => {
    if (groupToEdit) {
      setGroupName(groupToEdit.name);
      setAddresses(groupToEdit.addresses);
      setIsEditing(true);
      setSelectedGroupId(groupToEdit.id);
      setActiveTab("create");
    } else {
      setGroupName("");
      setAddresses([]);
      setIsEditing(false);
      setSelectedGroupId(null);
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

  const handleEditGroup = (group: Group) => {
    setGroupName(group.name);
    setAddresses([...group.addresses]);
    setIsEditing(true);
    setSelectedGroupId(group.id);
    setActiveTab("create");
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (confirm("Are you sure you want to delete this group?")) {
      try {
        await deleteGroup(groupId);
        toast({
          title: "Group deleted",
          description: "The group has been deleted successfully",
        });
      } catch (error) {
        console.error("Error deleting group:", error);
        toast({
          title: "Error",
          description: "Failed to delete group. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSubmit = async () => {
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

    setIsSubmitting(true);

    try {
      if (isEditing && selectedGroupId) {
        await updateGroup({
          id: selectedGroupId,
          name: groupName,
          addresses,
        });
        toast({
          title: "Group updated",
          description: `${groupName} has been updated successfully`,
        });
      } else {
        // For new groups, generate a temporary ID that will be replaced by the server
        const tempId = `temp-${Date.now()}`;
        await addGroup({
          id: tempId,
          name: groupName,
          addresses,
        });
        toast({
          title: "Group created",
          description: `${groupName} has been created successfully`,
        });
      }
      
      // Reset form
      setGroupName("");
      setAddresses([]);
      setIsEditing(false);
      setSelectedGroupId(null);
      
      // Close dialog if creating a new group
      if (!isEditing) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error saving group:", error);
      toast({
        title: "Error",
        description: "Failed to save group. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setGroupName("");
    setAddresses([]);
    setIsEditing(false);
    setSelectedGroupId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-medium">
            Email Groups
          </DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="create" onClick={() => resetForm()}>
              {isEditing ? "Edit Group" : "Create Group"}
            </TabsTrigger>
            <TabsTrigger value="manage">Manage Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4">
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

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => {
                resetForm();
                if (isEditing) {
                  setActiveTab("manage");
                }
              }}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : (isEditing ? "Update Group" : "Create Group")}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="manage">
            {groups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No groups created yet</p>
                <Button 
                  variant="outline" 
                  className="mt-2"
                  onClick={() => setActiveTab("create")}
                >
                  Create your first group
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div 
                      key={group.id}
                      className="border rounded-lg p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{group.name}</h3>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditGroup(group)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteGroup(group.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {group.addresses.length} {group.addresses.length === 1 ? 'address' : 'addresses'}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground truncate">
                        {group.addresses.slice(0, 2).join(", ")}
                        {group.addresses.length > 2 && ` and ${group.addresses.length - 2} more`}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            <DialogFooter className="pt-4">
              <Button 
                variant="default" 
                onClick={() => setActiveTab("create")}
              >
                Create New Group
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}