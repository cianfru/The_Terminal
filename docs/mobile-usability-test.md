---
description: A five-task moderated test script for the mobile site, and what counts as a pass.
---

# Mobile usability test

Automated checks prove a task is *possible* on a phone. They cannot tell you whether a person
understands what they are looking at, which is the thing this site lives or dies on. This is the
script for finding that out. It takes about 20 minutes per person; five people surface most of it.

{% hint style="info" %}
Run it on the participant's **own phone**, on the live site, with no preamble about what the project
is. More than half of real traffic arrives cold from a link on X, so a cold start is the honest
starting condition.
{% endhint %}

## Before you start

Ask permission to record the screen. Say plainly: *"I am testing the site, not you. There are no
wrong answers, and anything confusing is useful to me."*

Then the one rule that makes this worth doing: **do not help.** No hints, no pointing, no
"try tapping the menu." When they stall, ask *"what are you looking for?"* and wait. A silence you
find uncomfortable is usually the finding.

## The five tasks

Read each task aloud, then stop talking.

1. **Understand the offer.** "You have just landed here from a link. Look around for a minute, then
   tell me what this site is for and who made it."
2. **Find a valuation chart.** "Find something that tells you whether SPX6900 is cheap or expensive
   right now."
3. **Read the value and its meaning.** "What is the number saying today, and what does it mean?"
4. **Zoom into a period.** "Show me just 2025 on this chart."
5. **Return or save.** "Go back and find a different chart you would want to look at again, and keep
   it somewhere you could find it later."

## What to write down

For each task, record only what you observed, not what you concluded:

| Record | Example |
| --- | --- |
| Completed unaided? | yes / with a hint / abandoned |
| Time and taps | 40s, 6 taps |
| Where they looked first | the header, the big number, the chart |
| Exact words at the moment of confusion | "is this the price or the guess?" |
| Anything they said they expected | "I thought the arrow meant it went up today" |

## What counts as a pass

- **Tasks 1, 2, 5:** completed unaided by 4 of 5 people.
- **Task 3:** the person states the direction *and* the meaning in their own words. Reading the
  number aloud is not a pass; "62% has not moved in a year, so people are holding" is.
- **Task 4:** completed unaided by 3 of 5. Zoom is the most discoverable-by-accident interaction, so
  treat a lower bar here as expected rather than as success.
- **Zero critical failures**, where critical means: a person cannot get from the landing page to any
  chart, or states a confidently wrong reading of a number.

A wrong reading of a number is the most serious result this test can produce. The project's whole
position is that its figures are checkable; a figure that is reliably misread is a problem with the
presentation, not with the reader.

## Known gaps to watch for, not to prompt

These are unresolved as of this writing. Note whether they come up unprompted; do not steer anyone
towards them.

- Tooltips take a tap and stay put, but have **no visible close control** — you dismiss by tapping
  elsewhere. Watch whether anyone tries to close one and fails.
- The insight line sits above the chart on two charts so far. Watch whether people look for the
  meaning above the plot or hunt for it below.
- Search and Saved live *inside* Explore rather than being top-level destinations. Watch whether
  anyone looks for search on the home screen.

## After the five

Write one paragraph per participant the same day, while you still remember the tone. Then list every
observation that appeared for **two or more** people. Those are the findings; a single person's
stumble is a story, not a signal.
