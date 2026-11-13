# Todo Board — design

Since 2026-11-13 this app uses the shared App shell (`APP-SHELL.md`): calm light/dark theme,
lists by area with open counts, an always-open quick-add, round checkboxes, priority pills and
undoable remove / clear. The earlier "Personal Dispatch" theme below is kept for history.

---

# Design system

## Overview

Todo Board is a personal dispatch room: tasks enter as assignments, then move through a ruled active board. The design treats attention as a finite queue rather than a collection of cards.

## Colors

- Dispatch blue: `#1D3850`
- Cream paper: `#F2EEE4`
- Paper rule: `#BCB4A7`
- Red action: `#D6513C`
- Priority yellow: `#E5B75B`
- Cleared green: `#849D78`

## Typography

- Display and task titles: `Iowan Old Style`, `Palatino Linotype`, Georgia.
- Labels, counts, and filters: system monospace.
- Supporting copy: Helvetica system sans.

## Layout

- Oversized dispatch statement, followed by a dark incoming-work strip.
- Tasks are a ruled queue with checkbox, priority, category, and removal action.
- Mobile preserves the queue order and turns secondary columns into stacked row metadata.

## Elevation & Depth

Depth comes from the dark dispatch strip and paper/ink contrast. Avoid floating card piles.

## Shapes

Square controls, hairline rules, and one red identity block. Priority is a compact label, not a pill-heavy dashboard.

## Components

- Dispatch bar
- Assignment form
- Filter tabs
- Task queue row
- Empty board state

## Do's and Don'ts

- Do make the active queue the main object.
- Do preserve clear priority and completion states.
- Don't imply team collaboration or remote sync.
- Don't turn every task into a rounded card.
