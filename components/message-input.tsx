"use client";

import { useState, useRef, useCallback } from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Send,
  Paperclip,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo,
  Redo,
  Highlighter,
  Strikethrough,
  X,
} from "lucide-react";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import Highlight from "@tiptap/extension-highlight";
import { UnderlineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MessageInputProps {
  onSend: (content: string, attachments: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  showSend?: boolean;
  customSend?: () => void;
}

export function MessageInput({
  onSend,
  isLoading,
  placeholder,
  showSend = true,
  customSend,
}: MessageInputProps) {
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        dropcursor: {
          color: "rgba(0, 0, 0, 0.3)",
          width: 2,
        },
        history: {
          depth: 100,
          newGroupDelay: 500
        },
        bulletList: {
          HTMLAttributes: {
            class: "list-disc ml-4",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal ml-4",
          },
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Write something …",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline'
        }
      }),
      Underline,
      Strike,
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-purple-400 dark:bg-purple-300 px-0.5 rounded',
        }
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert w-full focus:outline-none min-h-0 flex-grow overflow-y-auto [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:ml-4 [&_ul>li]:pl-0 [&_ol>li]:pl-0 [&_ul>li]:relative [&_ol>li]:relative [&_ul>li]:marker:absolute [&_ol>li]:marker:left-0 [&_ol>li]:marker:left-0",
      },
    },
    content: "",
  });

  const openLinkDialog = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href || '';
    setLinkUrl(previousUrl);
    setIsLinkDialogOpen(true);
  }, [editor]);

  const saveLinkHandler = useCallback(() => {
    if (!editor) return;

    // If URL is empty, unset the link
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      // Add https if no protocol is specified
      const normalizedUrl = linkUrl.startsWith('http://') || linkUrl.startsWith('https://')
        ? linkUrl
        : `https://${linkUrl}`;

      editor.chain().focus().extendMarkRange('link').setLink({ href: normalizedUrl }).run();
    }

    setIsLinkDialogOpen(false);
  }, [editor, linkUrl]);

  const handleSend = () => {
    if (editor && !editor.isEmpty) {
      const content = editor.getHTML();
      onSend(content, attachments);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setAttachments((prev) => [...prev, ...files]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      <div
        className="border rounded-lg bg-background flex flex-col w-full h-full"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {editor && (
          <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
            <div className="flex items-center gap-1 rounded-md border bg-background shadow-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("bold") && "bg-muted"
                )}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("italic") && "bg-muted"
                )}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("underline") && "bg-muted"
                )}
              >
                <UnderlineIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("strike") && "bg-muted"
                )}
              >
                <Strikethrough className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("highlight") && "bg-muted"
                )}
              >
                <Highlighter className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={openLinkDialog}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("link") && "bg-muted"
                )}
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("bulletList") && "bg-muted"
                )}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={cn(
                  "flex-shrink-0",
                  editor.isActive("orderedList") && "bg-muted"
                )}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </div>
          </BubbleMenu>
        )}

        <div className="flex items-center gap-2 border-b p-2 flex-shrink-0 overflow-x-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={cn(
              "flex-shrink-0",
              editor?.isActive("bold") && "bg-muted"
            )}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={cn(
              "flex-shrink-0",
              editor?.isActive("italic") && "bg-muted"
            )}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            className={cn(
              "flex-shrink-0",
              editor?.isActive("underline") && "bg-muted"
            )}
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            className={cn(
              "flex-shrink-0",
              editor?.isActive("strike") && "bg-muted"
            )}
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor?.chain().focus().toggleHighlight().run()}
            className={cn(
              "flex-shrink-0",
              editor?.isActive("highlight") && "bg-muted"
            )}
          >
            <Highlighter className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={openLinkDialog}
            className={cn(
              "flex-shrink-0",
              editor?.isActive("link") && "bg-muted"
            )}
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={cn(
              "flex-shrink-0",
              editor?.isActive("bulletList") && "bg-muted"
            )}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={cn(
              "flex-shrink-0",
              editor?.isActive("orderedList") && "bg-muted"
            )}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <div className="h-6 w-px bg-border mx-2" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
            className="flex-shrink-0"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
            className="flex-shrink-0"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 p-2 overflow-y-auto">
          <EditorContent editor={editor} className="h-full" />
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 py-2 border-t flex-shrink-0">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-muted px-3 py-1 rounded-full text-sm flex-shrink-0"
              >
                <span className="truncate max-w-[200px]">{file.name}</span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center p-2 border-t flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              title="Attach files"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>
       
          {showSend && (
          <Button
            onClick={customSend ? customSend : handleSend}
            disabled={!editor || editor.isEmpty || isLoading}
            className="rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>)}

        </div>
      </div>

      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert link</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="url" className="text-right">
                URL
              </Label>
              <Input
                id="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="col-span-3"
                autoComplete="off"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveLinkHandler}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
