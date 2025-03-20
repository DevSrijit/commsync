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
  phoneNumbers: string[];
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
    phoneNumbers: string[];
  };
}

export default function GroupDialog({ open, onOpenChange, groupToEdit }: GroupDialogProps) {
  const { toast } = useToast();
  const { emails, groups, addGroup, updateGroup, deleteGroup } = useEmailStore() as EmailStoreWithGroups;

  const [activeTab, setActiveTab] = useState<string>("create");
  const [groupName, setGroupName] = useState("");
  const [addresses, setAddresses] = useState<string[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([]);
  const [newAddress, setNewAddress] = useState("");
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const [phoneSuggestions, setPhoneSuggestions] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [contactType, setContactType] = useState<"email" | "phone">("email");

  // Initialize form when editing an existing group
  useEffect(() => {
    if (groupToEdit) {
      setGroupName(groupToEdit.name);
      setAddresses(groupToEdit.addresses);
      setPhoneNumbers(groupToEdit.phoneNumbers || []);
      setIsEditing(true);
      setSelectedGroupId(groupToEdit.id);
      setActiveTab("create");
    } else {
      setGroupName("");
      setAddresses([]);
      setPhoneNumbers([]);
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

      setEmailSuggestions(filtered);
    } else {
      setEmailSuggestions([]);
    }
  }, [newAddress, emails, addresses]);

  // Generate phone number suggestions based on existing emails
  useEffect(() => {
    if (newPhoneNumber.length > 2) {
      // Extract unique phone numbers from emails
      const allPhoneNumbers = new Set<string>();

      emails.forEach(email => {
        // For SMS messages, phone numbers are in the email field
        const isSMS = email.accountType === 'twilio' || 
                     email.accountType === 'justcall' || 
                     (email.labels && email.labels.includes('SMS'));
        
        if (isSMS) {
          // Add from phone numbers
          if (email.from) {
            const fromPhone = email.from.email;
            if (fromPhone && !fromPhone.includes('@')) {
              allPhoneNumbers.add(fromPhone);
            }
          }

          // Add to phone numbers
          if (email.to) {
            email.to.forEach(recipient => {
              const toPhone = recipient.email;
              if (toPhone && !toPhone.includes('@')) {
                allPhoneNumbers.add(toPhone);
              }
            });
          }
        }
      });

      // Filter suggestions based on input
      const filtered = Array.from(allPhoneNumbers)
        .filter(phone =>
          phone.includes(newPhoneNumber) &&
          !phoneNumbers.includes(phone)
        )
        .slice(0, 5);

      setPhoneSuggestions(filtered);
    } else {
      setPhoneSuggestions([]);
    }
  }, [newPhoneNumber, emails, phoneNumbers]);

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
      setEmailSuggestions([]);
    }
  };

  const handleAddPhoneNumber = () => {
    if (newPhoneNumber && !phoneNumbers.includes(newPhoneNumber)) {
      setPhoneNumbers([...phoneNumbers, newPhoneNumber]);
      setNewPhoneNumber("");
    }
  };

  const handleRemovePhoneNumber = (phone: string) => {
    setPhoneNumbers(phoneNumbers.filter(p => p !== phone));
  };

  const handleSelectPhoneSuggestion = (suggestion: string) => {
    if (!phoneNumbers.includes(suggestion)) {
      setPhoneNumbers([...phoneNumbers, suggestion]);
      setNewPhoneNumber("");
      setPhoneSuggestions([]);
    }
  };

  const handleEditGroup = (group: Group) => {
    setGroupName(group.name);
    setAddresses([...group.addresses]);
    setPhoneNumbers(group.phoneNumbers ? [...group.phoneNumbers] : []);
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
          phoneNumbers,
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
          phoneNumbers,
        });
        toast({
          title: "Group created",
          description: `${groupName} has been created successfully`,
        });
      }
      
      // Reset form
      setGroupName("");
      setAddresses([]);
      setPhoneNumbers([]);
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
    setPhoneNumbers([]);
    setIsEditing(false);
    setSelectedGroupId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-medium">
            Contact Groups
          </DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mx-4 my-2">
            <TabsTrigger value="create">
              {isEditing ? "Edit Group" : "Create Group"}
            </TabsTrigger>
            <TabsTrigger value="view">View Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="px-4 py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="groupName">Group Name</Label>
                <Input
                  id="groupName"
                  placeholder="Enter group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="space-y-2">
                <Tabs className="w-full" value={contactType} onValueChange={(v) => setContactType(v as "email" | "phone")}>
                  <TabsList className="grid grid-cols-2">
                    <TabsTrigger value="email">Email Addresses</TabsTrigger>
                    <TabsTrigger value="phone">Phone Numbers</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="email" className="pt-4">
                    <Label htmlFor="newAddress">Add Email Addresses</Label>
                    <div className="flex mt-1">
                      <Input
                        id="newAddress"
                        placeholder="Enter email address"
                        value={newAddress}
                        onChange={(e) => setNewAddress(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleAddAddress}
                        type="button"
                        className="ml-2"
                        size="sm"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Email Suggestions */}
                    {emailSuggestions.length > 0 && (
                      <div className="mt-1 border rounded-md overflow-hidden">
                        {emailSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => handleSelectSuggestion(suggestion)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Added Email Addresses */}
                    {addresses.length > 0 && (
                      <div className="mt-4">
                        <Label>Added Email Addresses</Label>
                        <ScrollArea className="h-28 mt-1 border rounded-md p-2">
                          <div className="space-y-2">
                            {addresses.map((address) => (
                              <div
                                key={address}
                                className="flex items-center justify-between bg-gray-50 rounded p-2"
                              >
                                <span className="text-sm truncate">{address}</span>
                                <Button
                                  onClick={() => handleRemoveAddress(address)}
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="phone" className="pt-4">
                    <Label htmlFor="newPhoneNumber">Add Phone Numbers</Label>
                    <div className="flex mt-1">
                      <Input
                        id="newPhoneNumber"
                        placeholder="Enter phone number"
                        value={newPhoneNumber}
                        onChange={(e) => setNewPhoneNumber(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleAddPhoneNumber}
                        type="button"
                        className="ml-2"
                        size="sm"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Phone Suggestions */}
                    {phoneSuggestions.length > 0 && (
                      <div className="mt-1 border rounded-md overflow-hidden">
                        {phoneSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => handleSelectPhoneSuggestion(suggestion)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Added Phone Numbers */}
                    {phoneNumbers.length > 0 && (
                      <div className="mt-4">
                        <Label>Added Phone Numbers</Label>
                        <ScrollArea className="h-28 mt-1 border rounded-md p-2">
                          <div className="space-y-2">
                            {phoneNumbers.map((phone) => (
                              <div
                                key={phone}
                                className="flex items-center justify-between bg-gray-50 rounded p-2"
                              >
                                <span className="text-sm truncate">{phone}</span>
                                <Button
                                  onClick={() => handleRemovePhoneNumber(phone)}
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </TabsContent>
          
          {/* View Groups Tab - Need to update to display phone numbers too */}
          <TabsContent value="view" className="px-4 py-2 pb-4">
            {!groups || groups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No groups created yet.</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className="border rounded-md p-3 hover:border-gray-400 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{group.name}</h3>
                        <div className="flex space-x-1">
                          <Button
                            onClick={() => handleEditGroup(group)}
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteGroup(group.id)}
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      
                      {group.addresses.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 mb-1">Email Addresses:</p>
                          <ScrollArea className="h-16 border rounded-sm p-1">
                            <div className="space-y-1">
                              {group.addresses.map((address) => (
                                <div
                                  key={address}
                                  className="text-xs bg-gray-50 px-2 py-1 rounded"
                                >
                                  {address}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                      
                      {group.phoneNumbers && group.phoneNumbers.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Phone Numbers:</p>
                          <ScrollArea className="h-16 border rounded-sm p-1">
                            <div className="space-y-1">
                              {group.phoneNumbers.map((phone) => (
                                <div
                                  key={phone}
                                  className="text-xs bg-gray-50 px-2 py-1 rounded"
                                >
                                  {phone}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-4 py-3 border-t">
          {activeTab === "create" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                disabled={isSubmitting}
              >
                Reset
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
              >
                {isEditing ? "Update Group" : "Create Group"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}