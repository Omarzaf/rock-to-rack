export function openFeedbackLink(feedbackHref: string, locationRef: Location = window.location): void {
  if (feedbackHref.length === 0) {
    return;
  }

  locationRef.assign(feedbackHref);
}
