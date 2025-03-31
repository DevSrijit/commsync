import { NextResponse } from "next/server";
import Fuse from "fuse.js";
import { Contact, Email } from "@/lib/types";

export const runtime = "edge";
export const maxDuration = 5; // 5 seconds timeout

// Configure Fuse.js for contact search with optimized settings
const fuseOptions = {
  keys: [
    { name: "name", weight: 0.5 },
    { name: "email", weight: 0.3 },
    { name: "lastMessageSubject", weight: 0.2 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
  useExtendedSearch: true,
  ignoreLocation: true,
  shouldSort: true,
  findAllMatches: false,
  distance: 100,
  includeMatches: true,
};

// Configure Fuse.js for email content search with optimized settings
const emailFuseOptions = {
  keys: [
    { name: "subject", weight: 0.4 },
    { name: "body", weight: 0.6 },
  ],
  threshold: 0.5,
  includeScore: true,
  minMatchCharLength: 2,
  useExtendedSearch: true,
  ignoreLocation: true,
  shouldSort: true,
  findAllMatches: false,
  distance: 100,
  includeMatches: true,
};

interface SearchRequest {
  query: string;
  contacts: Contact[];
  emails: Email[];
}

export async function POST(request: Request) {
  try {
    const { query, contacts, emails } = (await request.json()) as SearchRequest;

    if (!query?.trim()) {
      return NextResponse.json({
        contacts: contacts,
        emails: emails,
        matches: [],
        rankedResults: contacts,
      });
    }

    // Create Fuse instances
    const contactFuse = new Fuse(contacts, fuseOptions);
    const emailFuse = new Fuse(emails, emailFuseOptions);

    // Search contacts and emails
    const contactResults = contactFuse.search(query);
    const emailResults = emailFuse.search(query);

    // Create a map to track contact scores
    const contactScores = new Map<string, number>();
    const contactMatches = new Map<string, Set<string>>();

    // Process contact results with scoring
    contactResults.forEach((result) => {
      const contact = result.item as Contact;
      if (contact.email) {
        const score = 1 - (result.score || 0);
        contactScores.set(contact.email, score);

        const matches = new Set<string>();
        result.matches?.forEach((match) => {
          if (match.key) matches.add(match.key);
        });
        contactMatches.set(contact.email, matches);
      }
    });

    // Process email results to enhance contact scores
    emailResults.forEach((result) => {
      const email = result.item as Email;
      const score = 1 - (result.score || 0);

      if (email.from.email) {
        const currentScore = contactScores.get(email.from.email) || 0;
        contactScores.set(
          email.from.email,
          Math.max(currentScore, score * 0.8)
        );
      }

      email.to.forEach((to) => {
        if (to.email) {
          const currentScore = contactScores.get(to.email) || 0;
          contactScores.set(to.email, Math.max(currentScore, score * 0.8));
        }
      });
    });

    // Create a set of matched contact emails
    const matchedContactEmails = new Set(contactScores.keys());

    // Get all unique matched contacts with scores
    const rankedContacts = contacts
      .filter((contact) => matchedContactEmails.has(contact.email))
      .map((contact) => ({
        ...contact,
        searchScore: contactScores.get(contact.email) || 0,
        matchedFields: Array.from(
          contactMatches.get(contact.email) || new Set()
        ),
      }))
      .sort((a, b) => b.searchScore - a.searchScore);

    return NextResponse.json({
      contacts: rankedContacts,
      emails: emailResults.map((result) => result.item as Email),
      matches: Array.from(matchedContactEmails),
      rankedResults: rankedContacts,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
