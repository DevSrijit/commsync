"use client"

import { useState, useRef } from "react"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Contact } from "@/lib/types"
import { Trash2, X } from "lucide-react"
import { useEmailStore } from "@/lib/email-store"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import Highlighter from 'react-highlight-words'

interface ContactItemProps {
  contact: Contact
  isSelected: boolean
  onClick: () => void
  onDelete?: (contactEmail: string) => void
  searchQuery?: string
  searchMatches?: Set<string>
  searchScore?: number
  matchedFields?: Set<string>
}

function displayLabels(labels: string) {
  //labels start with category_name, return just name
  if (labels.includes("CATEGORY_")) return labels.split("_")[1]
  return labels
}

export function ContactItem({
  contact,
  isSelected,
  onClick,
  onDelete,
  searchQuery = '',
  searchMatches = new Set(),
  searchScore = 0,
  matchedFields = new Set()
}: ContactItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()
  const { deleteConversation } = useEmailStore()
  const itemRef = useRef<HTMLDivElement>(null)
  const isMatched = searchMatches.has(contact.email)
  const searchWords = searchQuery.trim().split(/\s+/);

  // Calculate match quality indicator
  const getMatchQuality = () => {
    if (!searchQuery.trim()) return null;

    const score = searchScore;
    if (score >= 0.9) return 'exact';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  };

  const matchQuality = getMatchQuality();
  const matchQualityColor = matchQuality === 'exact' ? 'bg-green-500' :
    matchQuality === 'high' ? 'bg-blue-500' :
      matchQuality === 'medium' ? 'bg-yellow-500' :
        'bg-gray-500';

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    setIsDeleting(true)

    // Delete the conversation using the store function
    deleteConversation(contact.email)

    // Notify user
    toast({
      title: "Conversation deleted",
      description: `Conversation with ${contact.name} has been removed`,
    })

    // If onDelete is provided, call it
    if (onDelete) {
      onDelete(contact.email)
    }

    setIsDeleting(false)
    setShowDeleteConfirm(false)
  }

  // Add keyboard support for Delete key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      setShowDeleteConfirm(true)
    }
  }

  return (
    <>
      <div
        className={cn(
          "p-4 cursor-pointer hover:bg-accent/50 rounded-lg border m-2 overflow-hidden relative group",
          isSelected && "bg-accent"
        )}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Conversation with ${contact.name}`}
        ref={itemRef}
      >
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-2">
            {matchQuality && (
              <div className={cn(
                "w-2 h-2 rounded-full",
                matchQualityColor
              )} />
            )}
            <h3 className="font-medium">
              <Highlighter
                highlightClassName={cn(
                  "bg-yellow-200 dark:bg-yellow-900/50",
                  matchedFields.has('name') && "font-semibold"
                )}
                searchWords={searchWords}
                textToHighlight={contact.name}
                autoEscape
              />
            </h3>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(contact.lastMessageDate), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-muted-foreground truncate mb-2">
          <Highlighter
            highlightClassName={cn(
              "bg-yellow-200 dark:bg-yellow-900/50",
              matchedFields.has('lastMessageSubject') && "font-semibold"
            )}
            searchWords={searchWords}
            textToHighlight={contact.lastMessageSubject}
            autoEscape
          />
        </p>
        <div className="flex items-center gap-2">
          <div className="flex overflow-x-auto scroll-smooth flex-1">
            {contact.labels.map((label, index) => (
              <Badge
                key={`${label}-${index}`}
                variant="outline"
                className="text-xs whitespace-nowrap mr-1 dark:bg-neutral-900 bg-neutral-100"
              >
                {displayLabels(label)}
              </Badge>
            ))}
          </div>
          {matchQuality && (
            <Badge
              variant="outline"
              className="text-xs whitespace-nowrap"
            >
              {matchQuality === 'exact' ? 'Exact match' :
                matchQuality === 'high' ? 'High match' :
                  matchQuality === 'medium' ? 'Medium match' :
                    'Low match'}
            </Badge>
          )}
        </div>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 backdrop-blur-sm shadow-sm"
          onClick={handleDelete}
          aria-label="Delete conversation"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="sm:max-w-[425px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all messages between you and {contact.name} from your local cache. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
