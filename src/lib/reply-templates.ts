// Reply templates for responding to guests. Placeholders: {name} {date} {section} {staff} {sender} {role}
// The sender edits the text before sending, so these are starting points, never auto-sent.

export type ReplyTemplate = { key: string; label: string; suits: "high" | "low" | "any"; subject: string; body: string };

export const REPLY_TEMPLATES: ReplyTemplate[] = [
  {
    key: "gratitude",
    label: "Heartfelt thanks",
    suits: "high",
    subject: "Thank you for dining with us",
    body: `Dear {name},

Thank you for taking a moment to share your thoughts after your visit on {date}. It was a genuine pleasure to host you, and your kind words have been shared with the whole team.

Moments like yours are why we do what we do. We look forward to welcoming you back to the Lord Erroll very soon — do let us know when you are next coming, and we will make sure your table is waiting.

With warm regards,
{sender}
{role}, The Lord Erroll Gourmet Restaurant`,
  },
  {
    key: "staff-praise",
    label: "Thanks for recognising our team",
    suits: "high",
    subject: "Your kind words have reached {staff}",
    body: `Dear {name},

Thank you so much for mentioning {staff} in your feedback. I shared your message with them personally, and I can tell you it made their day.

Recognition like yours means a great deal to our team. We hope to have the pleasure of serving you again soon.

With warm regards,
{sender}
{role}, The Lord Erroll Gourmet Restaurant`,
  },
  {
    key: "apology",
    label: "Sincere apology",
    suits: "low",
    subject: "Our sincere apologies, {name}",
    body: `Dear {name},

Thank you for your candid feedback about your visit on {date}. Please accept my sincere apologies — what you experienced falls well short of the standard we hold ourselves to, and of the evening you deserved.

I have looked into what happened with the team in the {section}, and we are putting it right. I would be grateful for the chance to speak with you personally, and to welcome you back as our guest so that we may show you the Lord Erroll at its best.

You can reach me directly on +254 721 920820 or simply reply to this message.

With my apologies and warm regards,
{sender}
{role}, The Lord Erroll Gourmet Restaurant`,
  },
  {
    key: "follow-up",
    label: "Follow-up call request",
    suits: "low",
    subject: "May we speak with you?",
    body: `Dear {name},

Thank you for letting us know about your recent visit. Your feedback has been read carefully, and I would very much like to hear more so that we can make things right.

Would you be available for a short call at a time that suits you? Please reply with a convenient time, or call us on +254 721 920820 and ask for me by name.

With warm regards,
{sender}
{role}, The Lord Erroll Gourmet Restaurant`,
  },
  {
    key: "resolved",
    label: "We've made changes",
    suits: "any",
    subject: "An update following your feedback",
    body: `Dear {name},

I wanted to follow up personally on the feedback you shared after your visit on {date}. Thanks to you, we have reviewed this with our team and made changes so that it does not happen again.

It would be our pleasure to welcome you back and show you the difference. Please do mention this message when you book with us on +254 721 920820 or reservations@lord-erroll.com.

With sincere thanks,
{sender}
{role}, The Lord Erroll Gourmet Restaurant`,
  },
  {
    key: "suggestion",
    label: "Thanks for your suggestion",
    suits: "any",
    subject: "Thank you for your suggestion",
    body: `Dear {name},

Thank you for your thoughtful suggestion following your visit on {date}. I have shared it with our team, and we are giving it careful consideration.

Guests like you help us refine every detail. We look forward to welcoming you back soon.

With warm regards,
{sender}
{role}, The Lord Erroll Gourmet Restaurant`,
  },
];

export function fillTemplate(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}
