// Guest-facing copy. Tone: a seasoned maître d' — warm, unhurried, never effusive.

export type Lang = "en" | "sw";

const en = {
    langName: "English",
    switchTo: "Kiswahili",
    brandLine: "Gourmet Restaurant · Ruaka Road",
    stepOf: (a: number, b: number) => `Step ${a} of ${b}`,
    back: "Back",
    next: "Continue",
    skip: "Skip",
    optional: "Optional",

    welcomeTitle: "Thank you for dining with us",
    welcomeLine: "It was our pleasure to host you. Your thoughts help us perfect every visit.",
    welcomeCta: "Share Your Experience",
    welcomeTime: "About one minute · Every word is read by our Management",
    resumeNote: "We kept your answers safe — carry on where you left off.",
    startOver: "Start afresh",

    visitTitle: "Your visit",
    visitLine: "Tell us where you were seated so we can thank the right team.",
    section: "Seating area",
    table: "Table number",
    tablePlaceholder: "e.g. 12",
    occasion: "The occasion",
    date: "Date of visit",

    overallTitle: "Overall, how was your experience?",
    overallLine: "Tap a crown.",
    overallHint: "Please choose a rating to continue.",

    detailTitle: "A little more detail",
    detailLine: "Rate whatever you'd like to — leave the rest.",
    notApplicable: "N/A",

    chipsTitle: "What stood out?",
    chipsLine: "Choose as many as you like.",
    improveTitle: "What could be better?",

    staffTitle: "Did someone make your visit special?",
    staffLine: "We love passing on a kind word to our team.",
    staffName: "Their name",
    staffNamePlaceholder: "e.g. Grace at the bar",
    staffMessage: "A short message for them",
    staffMessagePlaceholder: "They'll see this at our next team briefing.",

    suggestTitle: "Anything else you'd like us to know?",
    suggestLine: "A suggestion, a compliment, or something we should put right.",
    suggestPlaceholder: "Write as much or as little as you wish…",
    speak: "Speak",
    listening: "Listening… tap to stop",
    voiceUnsupported: "Voice input isn't available in this browser.",
    addPhoto: "Add a photo",
    photoLimit: "Up to 3 photos",
    removePhoto: "Remove photo",

    npsTitle: "How likely are you to recommend us to a friend?",
    npsLow: "Not likely",
    npsHigh: "Extremely likely",

    contactTitle: "May we stay in touch?",
    contactLine: "Entirely optional. Leave these blank to remain anonymous.",
    name: "Your name",
    phone: "Phone or WhatsApp",
    email: "Email",
    followUp: "I would like management to follow up with me.",
    followUpNeedsContact: "Please leave a phone number or email so we can reach you.",
    anonymousNote: "Your feedback will be shared anonymously.",
    submit: "Send my feedback",
    sending: "Sending…",
    privacy: "We use your details only to respond to this feedback. They are never shared or used for marketing.",

    thanksTitle: "With our sincere thanks",
    thanksHigh:
      "It is a true pleasure to know your evening was a fine one. Your words have gone straight to our Management, and we look forward to welcoming you back to the Lord Erroll very soon.",
    thanksReviewAsk: "Would you share a few words with other diners?",
    thanksReview: "Leave a Google review",
    thanksFollow: "Follow us on Instagram",
    thanksLow:
      "We are truly sorry that your visit fell short of the standard you deserve — and the standard we hold ourselves to. Your feedback has gone directly to our Management, who read every word personally.",
    thanksLowPromise: "If you left your details, a member of our management team will be in touch within one day to make things right.",
    thanksLowNoContact: "Should you wish to speak with us directly, we would be grateful for the chance:",
    thanksMid: "Thank you for taking the time. Every comment is read by our Management and helps us refine the experience.",
    thanksQueued: "You appear to be offline. Your feedback is saved on this phone and will be sent automatically once you're connected.",
    thanksDone: "Close",
    shareAnother: "Leave feedback for another visit",

    alreadyTitle: "You've already shared your thoughts",
    alreadyLine: "Thank you — we received your feedback from this table a short while ago.",
    alreadyAnother: "This is about a different visit",

    errorGeneric: "We couldn't send that just now. Please check your connection and try again.",
    errorSpam: "Please take a moment longer before sending.",
    errorRate: "We've received a lot from this connection. Please try again in a little while.",
};

const sw: typeof en = {
    langName: "Kiswahili",
    switchTo: "English",
    brandLine: "Mgahawa wa Kifahari · Barabara ya Ruaka",
    stepOf: (a: number, b: number) => `Hatua ${a} kati ya ${b}`,
    back: "Rudi",
    next: "Endelea",
    skip: "Ruka",
    optional: "Si lazima",

    welcomeTitle: "Asante kwa kula nasi",
    welcomeLine: "Ilikuwa furaha yetu kukukaribisha. Maoni yako hutusaidia kuboresha kila ziara.",
    welcomeCta: "Shiriki Uzoefu Wako",
    welcomeTime: "Takriban dakika moja · Kila neno husomwa na Uongozi wetu",
    resumeNote: "Tumehifadhi majibu yako — endelea ulipoachia.",
    startOver: "Anza upya",

    visitTitle: "Ziara yako",
    visitLine: "Tuambie ulipoketi ili tumshukuru mhudumu sahihi.",
    section: "Eneo la kuketi",
    table: "Nambari ya meza",
    tablePlaceholder: "mf. 12",
    occasion: "Sababu ya ziara",
    date: "Tarehe ya ziara",

    overallTitle: "Kwa jumla, uzoefu wako ulikuwaje?",
    overallLine: "Gusa taji.",
    overallHint: "Tafadhali chagua alama ili kuendelea.",

    detailTitle: "Maelezo zaidi kidogo",
    detailLine: "Pima unachopenda — acha vilivyobaki.",
    notApplicable: "Hapana",

    chipsTitle: "Nini kilikuvutia zaidi?",
    chipsLine: "Chagua vingi upendavyo.",
    improveTitle: "Nini kingeweza kuwa bora?",

    staffTitle: "Kuna mtu aliyefanya ziara yako iwe ya kipekee?",
    staffLine: "Tunafurahia kuwafikishia wahudumu wetu neno la shukrani.",
    staffName: "Jina lake",
    staffNamePlaceholder: "mf. Grace wa baa",
    staffMessage: "Ujumbe mfupi kwake",
    staffMessagePlaceholder: "Ataiona katika kikao chetu kijacho cha timu.",

    suggestTitle: "Kuna jambo lingine ungependa tujue?",
    suggestLine: "Pendekezo, pongezi, au jambo tunalopaswa kurekebisha.",
    suggestPlaceholder: "Andika kwa urefu au ufupi upendavyo…",
    speak: "Ongea",
    listening: "Tunasikiliza… gusa kusimamisha",
    voiceUnsupported: "Kuongea hakupatikani kwenye kivinjari hiki.",
    addPhoto: "Ongeza picha",
    photoLimit: "Hadi picha 3",
    removePhoto: "Ondoa picha",

    npsTitle: "Kuna uwezekano gani utatupendekeza kwa rafiki?",
    npsLow: "Haiwezekani",
    npsHigh: "Hakika kabisa",

    contactTitle: "Tuendelee kuwasiliana?",
    contactLine: "Si lazima kabisa. Acha wazi ili ubaki bila kujulikana.",
    name: "Jina lako",
    phone: "Simu au WhatsApp",
    email: "Barua pepe",
    followUp: "Ningependa uongozi uwasiliane nami.",
    followUpNeedsContact: "Tafadhali acha nambari ya simu au barua pepe ili tukufikie.",
    anonymousNote: "Maoni yako yatatumwa bila jina.",
    submit: "Tuma maoni yangu",
    sending: "Inatuma…",
    privacy: "Tunatumia maelezo yako tu kujibu maoni haya. Hayashirikiwi wala kutumika kwa matangazo.",

    thanksTitle: "Kwa shukrani za dhati",
    thanksHigh:
      "Ni furaha kubwa kujua kwamba ziara yako ilikuwa nzuri. Maneno yako yamefikia Uongozi wetu moja kwa moja, na tunatarajia kukukaribisha tena Lord Erroll hivi karibuni.",
    thanksReviewAsk: "Ungependa kuwashirikisha wageni wengine maneno machache?",
    thanksReview: "Andika maoni Google",
    thanksFollow: "Tufuate Instagram",
    thanksLow:
      "Tunasikitika sana kwamba ziara yako haikufikia kiwango unachostahili — na kiwango tunachojiwekea. Maoni yako yamefikia Uongozi wetu moja kwa moja, ambao husoma kila neno wenyewe.",
    thanksLowPromise: "Ikiwa uliacha maelezo yako, mmoja wa uongozi wetu atawasiliana nawe ndani ya siku moja ili kurekebisha mambo.",
    thanksLowNoContact: "Ukipenda kuzungumza nasi moja kwa moja, tutashukuru kwa nafasi hiyo:",
    thanksMid: "Asante kwa muda wako. Kila maoni husomwa na Uongozi wetu na hutusaidia kuboresha huduma.",
    thanksQueued: "Inaonekana huna mtandao. Maoni yako yamehifadhiwa kwenye simu hii na yatatumwa yenyewe utakapounganishwa.",
    thanksDone: "Funga",
    shareAnother: "Toa maoni kuhusu ziara nyingine",

    alreadyTitle: "Tayari umeshiriki maoni yako",
    alreadyLine: "Asante — tulipokea maoni yako kutoka meza hii muda mfupi uliopita.",
    alreadyAnother: "Hii ni kuhusu ziara nyingine",

    errorGeneric: "Hatukuweza kutuma sasa hivi. Tafadhali angalia mtandao na ujaribu tena.",
    errorSpam: "Tafadhali chukua muda kidogo zaidi kabla ya kutuma.",
    errorRate: "Tumepokea mengi kutoka muunganisho huu. Tafadhali jaribu tena baadaye.",
};

export const COPY: Record<Lang, typeof en> = { en, sw };
export type Copy = typeof en;
