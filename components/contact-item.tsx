"use client"

import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Contact } from "@/lib/types"

interface ContactItemProps {
  contact: Contact
  isSelected: boolean
  onClick: () => void
}

function displayLabels(labels: string) {
  //labels start with category_name, return just name
  if (labels.includes("CATEGORY_")) return labels.split("_")[1]
  return labels
}

export function ContactItem({ contact, isSelected, onClick }: ContactItemProps) {
  return (
    <div className={cn("p-4 cursor-pointer hover:bg-accent/50", isSelected && "bg-accent")} onClick={onClick}>
      <div className="flex justify-between items-start mb-1">
        <h3 className="font-medium truncate">{contact.name}</h3>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(contact.lastMessageDate), { addSuffix: true })}
        </span>
      </div>
      <p className="text-sm text-muted-foreground truncate mb-2">{contact.lastMessageSubject}</p>
      <div className="flex gap-2">
        {contact.labels.map((label) => (
          <Badge key={label} variant="outline" className="text-xs bg-neutral-900">
            {displayLabels(label)}
          </Badge>
        ))}
      </div>
    </div>
  )
}

