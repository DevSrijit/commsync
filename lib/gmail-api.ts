import type { Email } from "@/lib/types"

export async function fetchEmails(accessToken: string): Promise<Email[]> {
  try {
    // Fetch list of messages
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch message list: ${response.statusText}`)
    }

    const data = await response.json()
    const messageIds = data.messages?.map((msg: any) => msg.id) || []

    // Fetch full details for each message
    const emails = await Promise.allSettled(
      messageIds.map(async (id: string) => {
        try {
          const msgResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          })

          if (!msgResponse.ok) {
            throw new Error(`Failed to fetch message ${id}: ${msgResponse.statusText}`)
          }

          const msgData = await msgResponse.json()
          return parseGmailMessage(msgData)
        } catch (error) {
          console.warn(`Failed to fetch message ${id}:`, error)
          return null
        }
      }),
    )

    // Filter out failed requests and return successful ones
    return emails
      .filter((result): result is PromiseFulfilledResult<Email> => 
        result.status === "fulfilled" && result.value !== null
      )
      .map(result => result.value)

  } catch (error) {
    console.error("Error fetching emails:", error)
    return []
  }
}

export async function sendEmail({
  accessToken,
  to,
  subject,
  body,
}: {
  accessToken: string
  to: string
  subject: string
  body: string
}): Promise<Email> {
  // Create email in RFC 2822 format with HTML content
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset="UTF-8"',
    'MIME-Version: 1.0',
    "",
    body
  ]

  const email = emailLines.join("\r\n")

  // Encode the email in base64
  const encodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  try {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: encodedEmail,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to send email: ${response.statusText}`)
    }

    const data = await response.json()

    // Fetch the sent message to get full details
    const msgResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${data.id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!msgResponse.ok) {
      throw new Error(`Failed to fetch sent message: ${msgResponse.statusText}`)
    }

    const msgData = await msgResponse.json()
    return parseGmailMessage(msgData)
  } catch (error) {
    console.error("Error sending email:", error)
    throw error
  }
}

function parseGmailMessage(message: any): Email {
  const headers = message.payload.headers

  const getHeader = (name: string) => {
    const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
    return header ? header.value : ""
  }

  const from = parseEmailAddress(getHeader("From"))
  
  // Fix: Get the raw string value first, then parse each address after splitting
  const toAddresses = getHeader("To")
  const to = toAddresses 
    ? toAddresses.split(",").map((addr: string) => parseEmailAddress(addr.trim()))
    : []
    
  const subject = getHeader("Subject")
  const date = getHeader("Date")

  // Extract body content
  let body = ""
  if (message.payload.parts) {
    const textPart = message.payload.parts.find((part: any) => part.mimeType === "text/plain")

    if (textPart && textPart.body.data) {
      body = decodeBase64(textPart.body.data)
    }
  } else if (message.payload.body && message.payload.body.data) {
    body = decodeBase64(message.payload.body.data)
  }

  // Extract labels
  const labels = message.labelIds || []

  return {
    id: message.id,
    threadId: message.threadId,
    from,
    to,
    subject,
    body,
    date,
    labels,
  }
}

function parseEmailAddress(address: string) {
  if (!address) return { name: "", email: "" }

  const match = address.match(/(.*?)\s*<(.+)>/)
  if (match) {
    return {
      name: match[1].trim().replace(/"/g, ""),
      email: match[2].trim(),
    }
  }

  return {
    name: address,
    email: address,
  }
}

function decodeBase64(data: string) {
  const text = atob(data.replace(/-/g, "+").replace(/_/g, "/"))
  return decodeURIComponent(escape(text))
}

