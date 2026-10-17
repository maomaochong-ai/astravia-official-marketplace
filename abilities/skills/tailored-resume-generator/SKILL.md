---
name: tailored-resume-generator
version: 1.0.0
description: Analyzes a job description and rewrites a resume against it — surfacing the experience, keywords and quantified achievements that posting screens for, matching ATS parsing rules, and reporting gaps plus interview talking points.
---

# Tailored Resume Generator

Tailoring is not rewriting from scratch. Reorder, re-emphasize and re-word the candidate's real experience so that a reviewer skimming for ten seconds sees the match between this posting and this person.

## When to use

- Applying for a specific role, and a generic resume would blur the relevant parts.
- Moving between industries or functions and needing transferable experience to read as relevant.
- Passing an ATS that screens on exact keywords before a human ever reads the file.
- Producing several versions of one resume for several similar postings.

## Inputs

Work with whatever the user already gave you. If a resume file is attached or sitting in the workspace, read it instead of asking the user to paste it again. Ask only for what is actually missing:

- The full job description, plus company name and title (the posting text, not a summary of it).
- The candidate's background, when no resume was provided: roles with companies and dates, responsibilities, education, skills, certifications, awards, and any numbers attached to their work.
- Constraints: page limit, region/market, language, format preference, sections to include or exclude.

If the posting is a link or a file, read it before answering. Do not start drafting while a must-have input is still missing.

## Workflow

### 1. Decompose the posting

Extract, in this order of weight:

- **Must-haves** — years of experience, hard requirements, required credentials. These are screening gates.
- **Core skills** — tools, methodologies, domain knowledge the role is built around.
- **Keywords** — terms repeated across responsibilities and requirements; these are what an ATS matches.
- **Signals** — team structure, seniority language, what the company says it values.
- **Nice-to-haves** — bonus skills that separate candidates without disqualifying anyone.

Keep a three-tier priority list: gates, strong preferences, bonuses.

### 2. Map evidence to each requirement

For every requirement, classify the candidate's material:

- **Direct match** — same tool, same scope, same outcome. Lead with it.
- **Transferable** — different setting, same underlying skill. Reframe it in the posting's vocabulary.
- **Gap** — no evidence. Do not paper over it; record it for the gap analysis in step 6.

### 3. Write the resume

**Professional summary (3–4 lines).** Target role and years of experience first, then the three or four skills the posting names, then the domain or outcome that makes this candidate distinct.

**Skills section.** Group by the posting's categories, required tools first. Use the posting's exact terminology where the candidate can substantiate it, with the acronym and the full term side by side: `SQL (Structured Query Language)`.

**Experience.** One entry per role, reverse chronological. Bullet pattern: **action verb + what was done + how + measurable result**. Reorder bullets so the ones matching the posting come first, and drop the ones that match nothing. Keep the original employer names, titles and dates untouched.

**Education and optional sections.** Degrees and certifications that the posting asks for or that support the target role; then only the optional sections that earn their space — projects, publications, awards, volunteer work.

### 4. Keep it parseable

- Standard headings: Professional Experience, Education, Skills. No creative section names.
- No tables, text boxes, columns, graphics, headers or footers in the ATS version.
- Standard bullets and fonts; no icons carrying meaning.
- Mirror the posting's job title in the summary where it is truthful.
- Plain-text or Markdown by default. When the user needs `.docx` or `.pdf`, generate it with the Word or PDF toolkit if it is installed, and validate the rendered result rather than trusting the conversion.

### 5. Format and present

Default output is Markdown: easy to read, easy to copy, easy to diff against the previous version. Offer plain text for ATS submission and formatting guidance for Word/PDF. Page length: one page under roughly ten years of experience, two pages beyond that, never more than two unless the role is genuinely senior.

Present the resume first, without commentary inside it. Commentary goes after.

### 6. Report honestly

After the resume, give:

- **Strengths** — what makes this candidate competitive for this specific posting, and what to reuse in the cover letter and interviews.
- **Gaps** — requirements not covered, and concrete ways to close them: a course, a project, a reframing of existing work.
- **Interview hooks** — three talking points drawn from the bullets, plus questions that show understanding of the role.
- **Cover letter openers** — two or three opening lines keyed to the posting, not generic enthusiasm.

### 7. Iterate

Offer the next adjustments: emphasis and tone, sections to add or cut, a version for another posting, a traditional versus modern layout.

## Writing rules

Do:

- Stay truthful. Never invent employers, dates, titles, degrees, certifications or metrics. If a number is missing, ask for it or write the bullet without one.
- Prefer the posting's own vocabulary when it describes the same thing accurately.
- Quantify where the candidate has numbers: percentages, volumes, time saved, team size, revenue.
- Keep it dense and scannable; cut adjectives that carry no information.
- Proofread for tense consistency, parallel bullet structure and spelling of tool names.

Don't:

- Use first-person pronouns.
- Add a photo, age, marital status, ID number or other personal identifiers unless the target market expects them and the user asks for them.
- Write "references available upon request".
- List every role from a twenty-year career; keep the relevant and recent ones.
- Ship a template with the placeholders still in it.
- Claim a skill on the candidate's behalf that their material does not support.

## Regional conventions

Ask which market the resume targets, then follow it rather than defaulting to one style:

- **US / Canada** — one page early career, no photo, no personal details, no date of birth.
- **UK / Europe** — a two-page CV is normal; a photo is optional and market-specific.
- **Mainland China** — one to two pages, photo and basic personal details are common, and 学历/专业/时间 must be exact; campus recruiting values internships, projects and awards heavily.

When the market is unclear, write the conservative version (no photo, no personal data) and say what you left out and why.

## Privacy

The candidate's resume is personal data. Use it only for the requested tailoring, never restate contact details in the surrounding commentary, and remind the user to review the output before sending it anywhere. Do not carry over information the user asked to omit.
