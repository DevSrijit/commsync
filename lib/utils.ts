import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts HTML content to plain text for SMS compatibility
 * @param html The HTML content to convert
 * @returns Plain text without any special formatting
 */
export function htmlToSmsText(html: string): string {
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  // Function to process text nodes
  function processTextNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      const children = Array.from(element.childNodes)
        .map((child) => processTextNode(child))
        .join("");

      // Handle different HTML elements
      switch (tagName) {
        case "p":
          return children + "\n\n";
        case "br":
          return "\n";
        case "ul":
        case "ol":
          return (
            Array.from(element.children)
              .map((li) => `• ${processTextNode(li)}`)
              .join("\n") + "\n"
          );
        case "li":
          return processTextNode(element) + "\n";
        case "a":
          const href = element.getAttribute("href");
          return href ? `${children} (${href})` : children;
        case "blockquote":
          return `> ${children}`;
        default:
          // For all other elements (strong, em, u, strike, etc.), just return the text content
          return children;
      }
    }

    return "";
  }

  // Process the HTML and clean up the result
  let result = processTextNode(tempDiv)
    // Remove multiple consecutive newlines
    .replace(/\n{3,}/g, "\n\n")
    // Remove multiple consecutive spaces
    .replace(/\s{2,}/g, " ")
    // Trim whitespace
    .trim();

  return result;
}
