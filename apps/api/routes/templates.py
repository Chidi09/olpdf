from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from ..core.supabase_client import get_supabase
from ..core.auth import get_current_user, ensure_profile_row
from ..models import TemplateResponse
from ..models.requests import PublishTemplatePayload
from ..repositories import DocumentRepository
from ..core.cache import cache_get, cache_set, cache_del_pattern
from ..core.cache_keys import templates_published


router = APIRouter(prefix="/templates", tags=["templates"])


def _user_id(current_user: dict) -> str:
    return str(current_user.get("sub") or current_user.get("user_id") or "")


FALLBACK_TEMPLATES: List[dict] = [
    {
        "id": "tpl_pitch-deck",
        "title": "Startup Pitch Deck",
        "category": "Business",
        "description": "10-slide investor-ready pitch deck covering problem, solution, market, traction, team, and financials.",
        "author": "OLPDF Studio",
        "uses_count": 1240,
        "thumbnail_url": "",
        "created_at": "2026-01-15T00:00:00Z",
    },
    {
        "id": "tpl_invoice",
        "title": "Invoice & Receipt Pack",
        "category": "Business",
        "description": "Professional invoice with receipt, payment terms, tax summary, and due-date tracking.",
        "author": "OLPDF Studio",
        "uses_count": 980,
        "thumbnail_url": "",
        "created_at": "2026-01-20T00:00:00Z",
    },
    {
        "id": "tpl_proposal",
        "title": "Consulting Proposal",
        "category": "Business",
        "description": "Scope, timeline, deliverables, pricing tiers, and integrated signature page.",
        "author": "OLPDF Studio",
        "uses_count": 760,
        "thumbnail_url": "",
        "created_at": "2026-02-01T00:00:00Z",
    },
    {
        "id": "tpl_nda",
        "title": "Legal NDA Agreement",
        "category": "Legal",
        "description": "Mutual non-disclosure agreement with defined parties, confidentiality terms, exclusions, and signature blocks.",
        "author": "OLPDF Legal",
        "uses_count": 2100,
        "thumbnail_url": "",
        "created_at": "2026-01-10T00:00:00Z",
    },
    {
        "id": "tpl_academic",
        "title": "Academic Research Paper",
        "category": "Academic",
        "description": "Structured paper with abstract, introduction, methodology, results, citations, and figures appendix.",
        "author": "OLPDF Studio",
        "uses_count": 3400,
        "thumbnail_url": "",
        "created_at": "2026-01-05T00:00:00Z",
    },
    {
        "id": "tpl_resume",
        "title": "Resume & Cover Letter",
        "category": "Personal",
        "description": "Modern two-page resume with matching cover letter, skills matrix, and reference section.",
        "author": "OLPDF Studio",
        "uses_count": 5600,
        "thumbnail_url": "",
        "created_at": "2026-01-01T00:00:00Z",
    },
    {
        "id": "tpl_real-estate",
        "title": "Real Estate Brochure",
        "category": "Business",
        "description": "Property profile with highlights, floor plan area, pricing table, and agent contact card.",
        "author": "OLPDF Studio",
        "uses_count": 890,
        "thumbnail_url": "",
        "created_at": "2026-02-10T00:00:00Z",
    },
    {
        "id": "tpl_spec",
        "title": "Product Specification",
        "category": "Business",
        "description": "Technical spec with overview, requirements, user stories, acceptance criteria, and changelog.",
        "author": "OLPDF Studio",
        "uses_count": 1500,
        "thumbnail_url": "",
        "created_at": "2026-02-15T00:00:00Z",
    },
    {
        "id": "tpl_event",
        "title": "Event Program",
        "category": "Personal",
        "description": "Event program with schedule grid, speaker profiles, sponsor pages, and venue map section.",
        "author": "OLPDF Studio",
        "uses_count": 670,
        "thumbnail_url": "",
        "created_at": "2026-03-01T00:00:00Z",
    },
    {
        "id": "tpl_manuscript",
        "title": "Book Manuscript",
        "category": "Books",
        "description": "Full book manuscript template with title page, copyright, linked chapters, acknowledgements, and back matter.",
        "author": "OLPDF Studio",
        "uses_count": 2300,
        "thumbnail_url": "",
        "created_at": "2026-01-25T00:00:00Z",
    },
]

@router.get("/", response_model=List[dict])
async def list_templates(category: Optional[str] = None):
    supabase = get_supabase()
    try:
        query = supabase.table("templates").select("*").eq("is_public", True)
        if category:
            query = query.eq("category", category)
        response = query.execute()
        if response.data:
            return response.data
    except Exception:
        pass

    # Cache DB results for 1 hour
    cache_key = templates_published()
    db_results = await cache_get(cache_key)
    if db_results:
        data = db_results
    else:
        try:
            query = supabase.table("templates").select("*").eq("is_public", True)
            if category:
                query = query.eq("category", category)
            response = query.execute()
            if response.data:
                data = response.data
                await cache_set(cache_key, data, ttl=3600)
            else:
                data = None
        except Exception:
            data = None

    if data:
        return data

    if category and category != "All":
        filtered = [t for t in FALLBACK_TEMPLATES if t["category"] == category]
        return filtered
    return FALLBACK_TEMPLATES

@router.post("/publish")
async def publish_template(
    payload: PublishTemplatePayload,
    current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    
    # Verify document ownership and get model
    user_id = _user_id(current_user)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    doc = supabase.table("documents").select("document_model").eq("id", payload.document_id).eq("user_id", user_id).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found or access denied")
        
    # Create template
    new_template = supabase.table("templates").insert({
        "title": payload.title,
        "category": payload.category,
        "description": payload.description,
        "document_model": doc.data["document_model"],
        "author_id": user_id,
        "author_name": current_user.get("user_metadata", {}).get("full_name", "Community Contributor"),
        "is_public": True,
        "uses_count": 0
    }).execute()
    
    if not new_template.data:
        raise HTTPException(status_code=500, detail="Failed to publish template")
        
    await cache_del_pattern("olpdf:templates:*")
    return {"status": "success", "template_id": new_template.data[0]["id"]}

def _build_template_model(template_id: str) -> Optional[dict]:
    fallback = next((t for t in FALLBACK_TEMPLATES if t["id"] == template_id), None)
    if not fallback:
        return None

    MODELS = {
        "tpl_pitch-deck": {
            "meta": {"title": "Startup Pitch Deck", "layout_mode": "editable", "template_id": "tpl_pitch-deck"},
            "blocks": [
                {"id": "pd-cover", "type": "heading", "content": {"text": "Startup Name", "level": 1}},
                {"id": "pd-tagline", "type": "paragraph", "content": {"text": "A compelling one-line description of what your company does and why it matters."}},
                {"id": "pd-problem", "type": "heading", "content": {"text": "The Problem", "level": 2}},
                {"id": "pd-problem-body", "type": "paragraph", "content": {"text": "Describe the pain point your target customer faces. Include relevant statistics, anecdotes, or market data that quantifies the problem's severity."}},
                {"id": "pd-solution", "type": "heading", "content": {"text": "Our Solution", "level": 2}},
                {"id": "pd-solution-body", "type": "paragraph", "content": {"text": "Explain how your product or service solves the identified problem. Highlight the core value proposition and what makes your approach unique."}},
                {"id": "pd-market", "type": "heading", "content": {"text": "Market Opportunity", "level": 2}},
                {"id": "pd-market-body", "type": "paragraph", "content": {"text": "TAM: $X billion. SAM: $Y million. Target: Z% market share within 3 years. Include market growth rate, key trends, and your target segment."}},
                {"id": "pd-product", "type": "heading", "content": {"text": "Product", "level": 2}},
                {"id": "pd-product-body", "type": "paragraph", "content": {"text": "Describe your product's key features, user experience, technology stack, and intellectual property. Include your development roadmap and milestones achieved."}},
                {"id": "pd-traction", "type": "heading", "content": {"text": "Traction & Milestones", "level": 2}},
                {"id": "pd-traction-body", "type": "paragraph", "content": {"text": "Month 1-3: MVP launch, 100 beta users. Month 4-6: 1,000 active users, $10K MRR. Month 7-9: Strategic partnership with key industry player. Month 10-12: Series A fundraise."}},
                {"id": "pd-competition", "type": "heading", "content": {"text": "Competitive Landscape", "level": 2}},
                {"id": "pd-competition-body", "type": "paragraph", "content": {"text": "Competitor A: Strengths (market share) / Weaknesses (aging tech). Competitor B: Strengths (brand) / Weaknesses (price). Our advantage: technology, speed, cost structure, and team."}},
                {"id": "pd-team", "type": "heading", "content": {"text": "The Team", "level": 2}},
                {"id": "pd-team-body", "type": "paragraph", "content": {"text": "CEO: Previous startup exited for $50M. CTO: 15 years at top tech company, 10 patents. COO: Operational experience scaling to 500+ employees. Advisory board includes industry leaders."}},
                {"id": "pd-financials", "type": "heading", "content": {"text": "Financial Projections", "level": 2}},
                {"id": "pd-financials-body", "type": "paragraph", "content": {"text": "Year 1: $500K revenue, 40% margin. Year 2: $2M revenue, 55% margin. Year 3: $8M revenue, 65% margin. Burn rate: $80K/month. Runway: 18 months."}},
                {"id": "pd-ask", "type": "heading", "content": {"text": "The Ask", "level": 2}},
                {"id": "pd-ask-body", "type": "paragraph", "content": {"text": "Raising $2M seed round at $10M valuation. Use of funds: Engineering (40%), Sales & Marketing (35%), Operations (15%), Reserve (10%)."}},
            ],
            "styles": {"font": "Inter", "body_size": 12, "heading_font": "Inter", "primary_color": "#000000", "accent_color": "#f97316"},
        },
        "tpl_invoice": {
            "meta": {"title": "Invoice & Receipt Pack", "layout_mode": "editable", "template_id": "tpl_invoice"},
            "blocks": [
                {"id": "inv-header", "type": "heading", "content": {"text": "INVOICE", "level": 1}},
                {"id": "inv-number", "type": "paragraph", "content": {"text": "Invoice #: INV-2026-0001\nDate: May 13, 2026\nDue Date: June 12, 2026"}},
                {"id": "inv-from", "type": "heading", "content": {"text": "From", "level": 2}},
                {"id": "inv-from-body", "type": "paragraph", "content": {"text": "Your Company Name\n123 Business Street\nCity, State ZIP\nTax ID: XX-XXXXXXX"}},
                {"id": "inv-to", "type": "heading", "content": {"text": "Bill To", "level": 2}},
                {"id": "inv-to-body", "type": "paragraph", "content": {"text": "Client Company Name\n456 Client Avenue\nCity, State ZIP\nAttn: Accounts Payable"}},
                {"id": "inv-items-heading", "type": "heading", "content": {"text": "Line Items", "level": 2}},
                {"id": "inv-items", "type": "paragraph", "content": {"text": "Item 1 — Design Services — 40 hrs @ $150/hr — $6,000.00\nItem 2 — Development Sprint — 80 hrs @ $200/hr — $16,000.00\nItem 3 — Project Management — 20 hrs @ $125/hr — $2,500.00"}},
                {"id": "inv-subtotal", "type": "paragraph", "content": {"text": "Subtotal: $24,500.00\nTax (8.5%): $2,082.50\nTotal Due: $26,582.50"}},
                {"id": "inv-terms", "type": "paragraph", "content": {"text": "Payment Terms: Net 30. Please include invoice number with payment. Make checks payable to Your Company Name. Bank transfer to: Bank of America, Account #XXXX1234, Routing #XXXXX."}},
                {"id": "inv-receipt", "type": "heading", "content": {"text": "Payment Receipt", "level": 2}},
                {"id": "inv-receipt-body", "type": "paragraph", "content": {"text": "This serves as a receipt of payment once the above amount has been received. Thank you for your business."}},
            ],
            "styles": {"font": "Inter", "body_size": 11, "heading_font": "Inter", "primary_color": "#000000", "accent_color": "#059669"},
        },
        "tpl_proposal": {
            "meta": {"title": "Consulting Proposal", "layout_mode": "editable", "template_id": "tpl_proposal"},
            "blocks": [
                {"id": "prop-cover", "type": "heading", "content": {"text": "Project Proposal", "level": 1}},
                {"id": "prop-prepared", "type": "paragraph", "content": {"text": "Prepared for: Client Name\nPrepared by: Your Name / Company\nDate: May 13, 2026"}},
                {"id": "prop-exec", "type": "heading", "content": {"text": "Executive Summary", "level": 2}},
                {"id": "prop-exec-body", "type": "paragraph", "content": {"text": "This proposal outlines a comprehensive engagement to deliver [specific outcome]. Our approach combines deep domain expertise with proven methodologies to ensure measurable results within the agreed timeline and budget."}},
                {"id": "prop-scope", "type": "heading", "content": {"text": "Scope of Work", "level": 2}},
                {"id": "prop-scope-body", "type": "paragraph", "content": {"text": "Phase 1: Discovery & Assessment (2 weeks) — Stakeholder interviews, systems audit, current-state analysis, gap identification.\n\nPhase 2: Strategy & Roadmap (3 weeks) — Solution architecture, implementation plan, resource plan, risk assessment.\n\nPhase 3: Execution & Delivery (8 weeks) — Agile sprints, milestone reviews, quality assurance, user acceptance testing.\n\nPhase 4: Handoff & Training (1 week) — Documentation, team training, knowledge transfer, post-launch support."}},
                {"id": "prop-deliverables", "type": "heading", "content": {"text": "Deliverables", "level": 2}},
                {"id": "prop-deliverables-body", "type": "paragraph", "content": {"text": "1. Current-state assessment report\n2. Solution architecture document\n3. Implemented and tested solution\n4. User documentation and training materials\n5. Post-deployment support package (30 days)"}},
                {"id": "prop-timeline", "type": "heading", "content": {"text": "Timeline", "level": 2}},
                {"id": "prop-timeline-body", "type": "paragraph", "content": {"text": "Total duration: 14 weeks\nStart date: June 1, 2026\nCompletion date: September 7, 2026\nMilestone check-ins: Bi-weekly status calls with written progress reports."}},
                {"id": "prop-pricing", "type": "heading", "content": {"text": "Pricing", "level": 2}},
                {"id": "prop-pricing-body", "type": "paragraph", "content": {"text": "Option A — Full Engagement: $85,000 (all phases, includes 30 days post-launch support)\nOption B — Strategy Only: $25,000 (Phases 1-2 only, with strategic recommendations report)\nOption C — Execution Only: $65,000 (Phases 3-4, requires existing strategy document)"}},
                {"id": "prop-signature", "type": "heading", "content": {"text": "Acceptance", "level": 2}},
                {"id": "prop-signature-body", "type": "paragraph", "content": {"text": "By signing below, you agree to the terms outlined in this proposal. Payment terms: 50% upon signing, 25% at midpoint, 25% upon completion.\n\nSignature: ________________________  Date: ____________"}},
            ],
            "styles": {"font": "Inter", "body_size": 11, "heading_font": "Inter", "primary_color": "#1e40af"},
        },
        "tpl_nda": {
            "meta": {"title": "Mutual Non-Disclosure Agreement", "layout_mode": "editable", "template_id": "tpl_nda"},
            "blocks": [
                {"id": "nda-title", "type": "heading", "content": {"text": "MUTUAL NON-DISCLOSURE AGREEMENT", "level": 1}},
                {"id": "nda-date", "type": "paragraph", "content": {"text": "Date: ______________\n\nThis Mutual Non-Disclosure Agreement ('Agreement') is entered into by and between:\n\nParty A: ______________________ ('Disclosing Party')\nParty B: ______________________ ('Receiving Party')"}},
                {"id": "nda-recitals", "type": "heading", "content": {"text": "Recitals", "level": 2}},
                {"id": "nda-recitals-body", "type": "paragraph", "content": {"text": "WHEREAS, the parties wish to explore a potential business relationship ('Purpose'); and\n\nWHEREAS, in the course of discussions, each party may disclose proprietary information to the other.\n\nNOW, THEREFORE, the parties agree as follows:"}},
                {"id": "nda-def", "type": "heading", "content": {"text": "1. Definition of Confidential Information", "level": 2}},
                {"id": "nda-def-body", "type": "paragraph", "content": {"text": "'Confidential Information' means any information disclosed by one party to the other, whether orally, in writing, or in any other form, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and circumstances of disclosure. This includes but is not limited to: business plans, financial data, technical specifications, customer lists, trade secrets, product roadmaps, and intellectual property."}},
                {"id": "nda-obligations", "type": "heading", "content": {"text": "2. Obligations of Receiving Party", "level": 2}},
                {"id": "nda-obligations-body", "type": "paragraph", "content": {"text": "The Receiving Party agrees to:\na) Maintain the Confidential Information in strict confidence;\nb) Not disclose Confidential Information to any third party without prior written consent;\nc) Use Confidential Information solely for the Purpose;\nd) Limit access to those employees who have a need to know and are bound by confidentiality obligations;\ne) Return or destroy all Confidential Information upon request."}},
                {"id": "nda-exclusions", "type": "heading", "content": {"text": "3. Exclusions", "level": 2}},
                {"id": "nda-exclusions-body", "type": "paragraph", "content": {"text": "Confidential Information does not include information that:\na) Is or becomes publicly available through no fault of the Receiving Party;\nb) Was known to the Receiving Party prior to disclosure;\nc) Is independently developed by the Receiving Party without use of Confidential Information;\nd) Is rightfully obtained from a third party without restriction."}},
                {"id": "nda-term", "type": "heading", "content": {"text": "4. Term and Termination", "level": 2}},
                {"id": "nda-term-body", "type": "paragraph", "content": {"text": "This Agreement shall commence on the date above and continue for a period of two (2) years. The obligations of confidentiality shall survive for three (3) years from the date of disclosure."}},
                {"id": "nda-general", "type": "heading", "content": {"text": "5. General Provisions", "level": 2}},
                {"id": "nda-general-body", "type": "paragraph", "content": {"text": "This Agreement constitutes the entire understanding between the parties. It may be modified only in writing signed by both parties. This Agreement is governed by the laws of [State/Country].\n\nIN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above."}},
                {"id": "nda-signatures", "type": "heading", "content": {"text": "Signatures", "level": 2}},
                {"id": "nda-signatures-body", "type": "paragraph", "content": {"text": "Party A:\nSignature: ________________________\nName: ____________________________\nTitle: _____________________________\n\nParty B:\nSignature: ________________________\nName: ____________________________\nTitle: _____________________________"}},
            ],
            "styles": {"font": "Inter", "body_size": 11, "heading_font": "Inter", "primary_color": "#1e293b"},
        },
        "tpl_academic": {
            "meta": {"title": "Academic Research Paper", "layout_mode": "editable", "template_id": "tpl_academic"},
            "blocks": [
                {"id": "ac-title", "type": "heading", "content": {"text": "Research Paper Title", "level": 1}},
                {"id": "ac-authors", "type": "paragraph", "content": {"text": "Author A¹, Author B², Author C¹*\n\n¹ Department of Computer Science, University Name\n² Department of Mathematics, University Name\n* Corresponding author: author@university.edu"}},
                {"id": "ac-abstract", "type": "heading", "content": {"text": "Abstract", "level": 2}},
                {"id": "ac-abstract-body", "type": "paragraph", "content": {"text": "This paper presents a novel approach to [research problem]. We propose [method/technique] that addresses the limitations of existing approaches by [key innovation]. Through extensive experiments on [datasets], we demonstrate that our method achieves [X% improvement] over baseline approaches. Our findings suggest that [key insight] has significant implications for the field of [domain]."}},
                {"id": "ac-keywords", "type": "paragraph", "content": {"text": "Keywords: machine learning, natural language processing, deep learning, transformers, evaluation"}},
                {"id": "ac-intro", "type": "heading", "content": {"text": "1. Introduction", "level": 2}},
                {"id": "ac-intro-body", "type": "paragraph", "content": {"text": "The field of [research area] has seen remarkable progress in recent years, driven by advances in [technology/methodology]. However, several fundamental challenges remain unsolved. Chief among these is [specific problem], which limits the applicability of current methods in real-world settings. In this work, we address this gap by introducing [contribution]. Our main contributions are: (1) We identify and formalize the problem of [X]; (2) We propose [Y], a novel approach that combines [techniques]; (3) We conduct comprehensive experiments showing [Z]."}},
                {"id": "ac-related", "type": "heading", "content": {"text": "2. Related Work", "level": 2}},
                {"id": "ac-related-body", "type": "paragraph", "content": {"text": "Previous work in this area can be broadly categorized into three streams. First, [Author et al., 2020] proposed [method], which achieved [results] but suffers from [limitation]. Second, [Author et al., 2022] introduced [alternative approach], demonstrating [results] on benchmark datasets. Third, [Author et al., 2023] explored [related technique], showing promising results in [domain]. Our work differs from these approaches in that we [differentiation]."}},
                {"id": "ac-method", "type": "heading", "content": {"text": "3. Methodology", "level": 2}},
                {"id": "ac-method-body", "type": "paragraph", "content": {"text": "3.1 Problem Formulation\nLet X = {x₁, ..., xₙ} be the input space and Y = {y₁, ..., yₘ} be the output space. We define a mapping f: X → Y parameterized by θ that minimizes the objective function L(θ) = Σᵢ ℓ(f(xᵢ; θ), yᵢ) + λR(θ).\n\n3.2 Proposed Architecture\nOur architecture consists of three components: (a) An encoder module that transforms raw inputs into latent representations; (b) A reasoning module that performs inference over the latent space; (c) A decoder module that generates the final output.\n\n3.3 Training Procedure\nWe train our model using the Adam optimizer with a learning rate of 1e-4, batch size of 32, and early stopping with patience of 10 epochs. Data augmentation techniques including random cropping and color jitter are applied during training."}},
                {"id": "ac-results", "type": "heading", "content": {"text": "4. Experimental Results", "level": 2}},
                {"id": "ac-results-body", "type": "paragraph", "content": {"text": "4.1 Datasets\nWe evaluate our method on three benchmark datasets: Dataset A (10K samples, 5 classes), Dataset B (50K samples, 10 classes), and Dataset C (100K samples, 100 classes).\n\n4.2 Baselines\nWe compare against the following baselines: (1) Baseline Method 1; (2) Baseline Method 2; (3) State-of-the-art method.\n\n4.3 Quantitative Results\nOur method achieves 94.2% accuracy on Dataset A (vs. 91.5% SOTA), 87.6% on Dataset B (vs. 85.1% SOTA), and 72.3% on Dataset C (vs. 70.8% SOTA). The improvements are statistically significant with p < 0.01."}},
                {"id": "ac-conclusion", "type": "heading", "content": {"text": "5. Conclusion", "level": 2}},
                {"id": "ac-conclusion-body", "type": "paragraph", "content": {"text": "In this paper, we introduced [method], a novel approach to [problem]. Experimental results demonstrate that our method achieves state-of-the-art performance across multiple benchmarks. Future work includes extending our approach to [related problem] and exploring [new direction]."}},
                {"id": "ac-references", "type": "heading", "content": {"text": "References", "level": 2}},
                {"id": "ac-references-body", "type": "paragraph", "content": {"text": "[1] Author, A., et al. (2020). Title of Paper. Conference Name, 1-10.\n[2] Author, B., et al. (2022). Another Paper. Journal Name, 15(3), 200-215.\n[3] Author, C., et al. (2023). Third Reference. Conference Name, 50-60.\n[4] Author, D., et al. (2024). Latest Work. arXiv preprint arXiv:2401.XXXXX."}},
            ],
            "styles": {"font": "Inter", "body_size": 11, "heading_font": "Inter", "primary_color": "#000000"},
        },
        "tpl_resume": {
            "meta": {"title": "Resume & Cover Letter", "layout_mode": "editable", "template_id": "tpl_resume"},
            "blocks": [
                {"id": "res-name", "type": "heading", "content": {"text": "Your Full Name", "level": 1}},
                {"id": "res-contact", "type": "paragraph", "content": {"text": "City, State | phone@email.com | (555) 123-4567 | linkedin.com/in/yourprofile | portfolio.dev"}},
                {"id": "res-summary", "type": "heading", "content": {"text": "Professional Summary", "level": 2}},
                {"id": "res-summary-body", "type": "paragraph", "content": {"text": "Results-driven professional with X+ years of experience in [industry/field]. Proven track record of [key achievement] with a focus on [specialization]. Adept at [skill 1], [skill 2], and [skill 3], with a strong commitment to delivering high-quality results in fast-paced environments."}},
                {"id": "res-experience", "type": "heading", "content": {"text": "Experience", "level": 2}},
                {"id": "res-exp1-title", "type": "heading", "content": {"text": "Senior Position Title", "level": 3}},
                {"id": "res-exp1-org", "type": "paragraph", "content": {"text": "Company Name | City, State | Jan 2022 – Present"}},
                {"id": "res-exp1-body", "type": "paragraph", "content": {"text": "• Led cross-functional team of 8 engineers to deliver platform redesign, resulting in 40% improvement in user engagement\n• Designed and implemented scalable architecture handling 10M+ daily requests with 99.9% uptime\n• Reduced operational costs by 25% through infrastructure optimization and automation\n• Mentored 5 junior engineers through structured onboarding and code review programs"}},
                {"id": "res-exp2-title", "type": "heading", "content": {"text": "Previous Position Title", "level": 3}},
                {"id": "res-exp2-org", "type": "paragraph", "content": {"text": "Company Name | City, State | Jun 2019 – Dec 2021"}},
                {"id": "res-exp2-body", "type": "paragraph", "content": {"text": "• Developed core product features serving 500K+ users using React, Node.js, and PostgreSQL\n• Improved application performance by 60% through code optimization and caching strategies\n• Established CI/CD pipeline reducing deployment time from 2 hours to 12 minutes\n• Collaborated with product team to define and ship 3 major product releases on schedule"}},
                {"id": "res-education", "type": "heading", "content": {"text": "Education", "level": 2}},
                {"id": "res-edu-body", "type": "paragraph", "content": {"text": "Bachelor of Science in Computer Science\nUniversity Name | Graduated May 2019 | GPA: 3.8/4.0\nHonors: Dean's List (all semesters), Computer Science Department Award"}},
                {"id": "res-skills", "type": "heading", "content": {"text": "Skills", "level": 2}},
                {"id": "res-skills-body", "type": "paragraph", "content": {"text": "Languages: JavaScript/TypeScript, Python, Java, SQL\nFrameworks: React, Next.js, Node.js, Express, FastAPI\nTools: Docker, Kubernetes, AWS, Git, CI/CD, Terraform\nSoft Skills: Team leadership, Technical communication, Agile methodologies, Strategic planning"}},
                {"id": "res-certifications", "type": "heading", "content": {"text": "Certifications", "level": 2}},
                {"id": "res-certs-body", "type": "paragraph", "content": {"text": "• AWS Solutions Architect – Professional (2025)\n• Google Cloud Professional Data Engineer (2024)\n• Certified Kubernetes Administrator (2023)"}},
                {"id": "res-cover-letter", "type": "heading", "content": {"text": "Cover Letter", "level": 2}},
                {"id": "res-cover-date", "type": "paragraph", "content": {"text": "May 13, 2026\n\nHiring Manager\nCompany Name\nCompany Address"}},
                {"id": "res-cover-body", "type": "paragraph", "content": {"text": "Dear Hiring Manager,\n\nI am writing to express my strong interest in the [Position] role at [Company]. With [X] years of experience in [field] and a proven track record of [achievement], I am confident that my skills align perfectly with your team's needs.\n\nIn my current role at [Current Company], I [specific achievement]. This experience, combined with my expertise in [relevant skill], makes me well-suited to contribute to [Company]'s goals in [specific area].\n\nI am particularly drawn to [Company] because of [reason]. I would welcome the opportunity to discuss how my background and skills can contribute to your team's success.\n\nThank you for your time and consideration.\n\nSincerely,\nYour Full Name"}},
            ],
            "styles": {"font": "Inter", "body_size": 10.5, "heading_font": "Inter", "primary_color": "#000000"},
        },
        "tpl_real-estate": {
            "meta": {"title": "Real Estate Brochure", "layout_mode": "editable", "template_id": "tpl_real-estate"},
            "blocks": [
                {"id": "re-title", "type": "heading", "content": {"text": "Property Name/Location", "level": 1}},
                {"id": "re-tagline", "type": "paragraph", "content": {"text": "Luxury living in the heart of [neighborhood]. Where elegance meets modern convenience."}},
                {"id": "re-overview", "type": "heading", "content": {"text": "Property Overview", "level": 2}},
                {"id": "re-overview-body", "type": "paragraph", "content": {"text": "Price: $X,XXX,XXX\nBedrooms: X | Bathrooms: X | Square Footage: X,XXX sq ft\nLot Size: X.XX acres | Year Built: 2024\nProperty Type: Single Family Home | Status: For Sale"}},
                {"id": "re-highlights", "type": "heading", "content": {"text": "Highlights", "level": 2}},
                {"id": "re-highlights-body", "type": "paragraph", "content": {"text": "• Gourmet chef's kitchen with quartz countertops and premium stainless steel appliances\n• Primary suite with spa-inspired bathroom, walk-in closet, and private balcony\n• Hardwood floors throughout, 10-foot ceilings, floor-to-ceiling windows\n• Smart home system with automated lighting, climate control, and security\n• Heated saltwater pool, professional landscaping, and outdoor kitchen\n• Two-car attached garage with EV charging station"}},
                {"id": "re-floorplan", "type": "heading", "content": {"text": "Floor Plan", "level": 2}},
                {"id": "re-floorplan-body", "type": "paragraph", "content": {"text": "Main Level: Open concept living/dining/kitchen (800 sq ft), powder room, home office (120 sq ft), mudroom.\nUpper Level: Primary suite (400 sq ft) with 5-piece ensuite, bedrooms 2-4 (300-350 sq ft each), full bathroom, laundry room.\nLower Level: Finished basement (1,000 sq ft) with recreation room, home theater, wet bar, guest bedroom, full bathroom."}},
                {"id": "re-neighborhood", "type": "heading", "content": {"text": "Neighborhood", "level": 2}},
                {"id": "re-neighborhood-body", "type": "paragraph", "content": {"text": "Located in the prestigious [neighborhood name], this property offers unparalleled access to:\n• Top-rated schools (District X)\n• 5-minute walk to [park/green space]\n• 10 minutes to downtown shopping and dining\n• 15 minutes to major highway/interstate\n• 20 minutes to international airport"}},
                {"id": "re-contact", "type": "heading", "content": {"text": "Contact", "level": 2}},
                {"id": "re-contact-body", "type": "paragraph", "content": {"text": "Listing Agent: Agent Full Name\nAgency: Real Estate Agency Name\nPhone: (555) 123-4567\nEmail: agent@agency.com\n\nSchedule a private showing today."}},
            ],
            "styles": {"font": "Inter", "body_size": 11, "heading_font": "Inter", "primary_color": "#000000", "accent_color": "#0ea5e9"},
        },
        "tpl_spec": {
            "meta": {"title": "Product Specification", "layout_mode": "editable", "template_id": "tpl_spec"},
            "blocks": [
                {"id": "spec-title", "type": "heading", "content": {"text": "Product Specification", "level": 1}},
                {"id": "spec-meta", "type": "paragraph", "content": {"text": "Product: [Product Name]\nVersion: 1.0.0\nAuthor: [Author Name]\nStatus: Draft | Last Updated: May 13, 2026"}},
                {"id": "spec-overview", "type": "heading", "content": {"text": "1. Overview", "level": 2}},
                {"id": "spec-overview-body", "type": "paragraph", "content": {"text": "1.1 Purpose\n[Product Name] is a [type of product] designed to [primary purpose]. It addresses the need for [user need] by providing [key capability].\n\n1.2 Scope\nThis specification covers functional requirements, technical architecture, user interface design, performance criteria, and acceptance criteria for the initial release."}},
                {"id": "spec-reqs", "type": "heading", "content": {"text": "2. Functional Requirements", "level": 2}},
                {"id": "spec-reqs-body", "type": "paragraph", "content": {"text": "FR-01: User Authentication — The system shall support email/password and OAuth (Google, GitHub) authentication.\nFR-02: Document Creation — Users shall be able to create, edit, and delete documents with rich text formatting.\nFR-03: Real-time Collaboration — Multiple users shall be able to edit the same document simultaneously with cursor presence and conflict resolution.\nFR-04: Export — Documents shall be exportable to PDF, DOCX, and Markdown formats.\nFR-05: Search — Full-text search across all user documents with filtering by date, type, and tags."}},
                {"id": "spec-arch", "type": "heading", "content": {"text": "3. Technical Architecture", "level": 2}},
                {"id": "spec-arch-body", "type": "paragraph", "content": {"text": "3.1 Frontend\nNext.js 16 with TypeScript, Tailwind CSS for styling, Zustand for state management, TipTap for rich text editing.\n\n3.2 Backend\nPython FastAPI with Supabase for database and authentication. Worker tasks for background processing.\n\n3.3 Infrastructure\nVercel for frontend hosting, Docker containers on VPS for backend API, Supabase for PostgreSQL database and storage, R2 for object storage."}},
                {"id": "spec-ux", "type": "heading", "content": {"text": "4. User Experience", "level": 2}},
                {"id": "spec-ux-body", "type": "paragraph", "content": {"text": "4.1 User Flows\nFlow 1: Sign up → Create first document → Edit content → Save/Export\nFlow 2: Import PDF → Auto-parse → Edit in fidelity mode → Export\nFlow 3: Create book → Add chapters → Write content → Generate PDF\n\n4.2 Design Principles\n• Minimal interface that prioritizes content\n• Keyboard-first navigation with comprehensive shortcuts\n• Visual feedback for every user action\n• Consistent spacing and typography throughout"}},
                {"id": "spec-acceptance", "type": "heading", "content": {"text": "5. Acceptance Criteria", "level": 2}},
                {"id": "spec-acceptance-body", "type": "paragraph", "content": {"text": "AC-01: All functional requirements pass integration tests\nAC-02: Page load time < 2 seconds on 3G connection\nAC-03: 99.9% uptime for core API endpoints\nAC-04: Zero critical security vulnerabilities\nAC-05: Accessibility score > 90 on Lighthouse audit\nAC-06: Cross-browser compatibility (Chrome, Firefox, Safari, Edge)"}},
                {"id": "spec-changelog", "type": "heading", "content": {"text": "6. Changelog", "level": 2}},
                {"id": "spec-changelog-body", "type": "paragraph", "content": {"text": "v1.0.0 (2026-05-13) — Initial specification document created.\n— Added functional requirements for core features\n— Documented technical architecture decisions\n— Established acceptance criteria for QA process"}},
            ],
            "styles": {"font": "Inter", "body_size": 11, "heading_font": "Inter", "primary_color": "#000000"},
        },
        "tpl_event": {
            "meta": {"title": "Event Program", "layout_mode": "editable", "template_id": "tpl_event"},
            "blocks": [
                {"id": "ev-title", "type": "heading", "content": {"text": "Event Name", "level": 1}},
                {"id": "ev-subtitle", "type": "paragraph", "content": {"text": "Date: May 13, 2026 | Location: Venue Name, City\nHashtag: #EventHashtag"}},
                {"id": "ev-welcome", "type": "heading", "content": {"text": "Welcome", "level": 2}},
                {"id": "ev-welcome-body", "type": "paragraph", "content": {"text": "Welcome to [Event Name]! We are thrilled to have you join us for a day of inspiration, learning, and connection. Today's program features [number] speakers, [number] workshops, and [number] networking sessions designed to [event goal]."}},
                {"id": "ev-schedule", "type": "heading", "content": {"text": "Schedule", "level": 2}},
                {"id": "ev-schedule-body", "type": "paragraph", "content": {"text": "8:00 AM — Registration & Breakfast\n9:00 AM — Opening Keynote: [Speaker Name]\n10:00 AM — Workshop Session 1 (Track A / Track B / Track C)\n11:30 AM — Networking Break\n12:00 PM — Panel Discussion: [Topic]\n1:00 PM — Lunch\n2:00 PM — Workshop Session 2\n3:30 PM — Lightning Talks (5 talks x 10 min)\n4:30 PM — Closing Keynote: [Speaker Name]\n5:30 PM — Networking Reception"}},
                {"id": "ev-speakers", "type": "heading", "content": {"text": "Speakers", "level": 2}},
                {"id": "ev-speaker1", "type": "heading", "content": {"text": "Keynote Speaker", "level": 3}},
                {"id": "ev-speaker1-body", "type": "paragraph", "content": {"text": "Speaker Name\nTitle, Company\nBio: Accomplished professional with expertise in [domain]. Previously [previous role], currently leading [current initiative]."}},
                {"id": "ev-speaker2", "type": "heading", "content": {"text": "Panelists", "level": 3}},
                {"id": "ev-speaker2-body", "type": "paragraph", "content": {"text": "Panelist 1 — Title, Company — Expert in [field]\nPanelist 2 — Title, Company — Specialist in [field]\nPanelist 3 — Title, Company — Pioneer in [field]\nModerator: Name — Title, Company"}},
                {"id": "ev-sponsors", "type": "heading", "content": {"text": "Sponsors", "level": 2}},
                {"id": "ev-sponsors-body", "type": "paragraph", "content": {"text": "Platinum Sponsor: [Company Name]\nGold Sponsors: [Company Name], [Company Name]\nSilver Sponsors: [Company Name], [Company Name], [Company Name]\n\nThank you to our sponsors for making this event possible!"}},
                {"id": "ev-venue", "type": "heading", "content": {"text": "Venue Map", "level": 2}},
                {"id": "ev-venue-body", "type": "paragraph", "content": {"text": "Main Hall — Keynotes and panels (Floor 1, Room A)\nWorkshop Rooms B, C, D — Breakout sessions (Floor 2)\nExhibition Area — Sponsor booths (Floor 1, Lobby)\nNetworking Lounge — Refreshments and informal meetings (Floor 1, Room B)\nRegistration Desk — Main entrance"}},
            ],
            "styles": {"font": "Inter", "body_size": 11, "heading_font": "Inter", "primary_color": "#000000", "accent_color": "#8b5cf6"},
        },
        "tpl_manuscript": {
            "meta": {"title": "Book Manuscript", "layout_mode": "editable", "template_id": "tpl_manuscript"},
            "blocks": [
                {"id": "ms-title-page", "type": "heading", "content": {"text": "Book Title", "level": 1}},
                {"id": "ms-subtitle", "type": "paragraph", "content": {"text": "Subtitle: A compelling description\n\nAuthor Name\n\n[Publisher Logo/Name]\nYear: 2026"}},
                {"id": "ms-copyright", "type": "heading", "content": {"text": "Copyright", "level": 2}},
                {"id": "ms-copyright-body", "type": "paragraph", "content": {"text": "Copyright © 2026 by Author Name\nAll rights reserved. No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the publisher, except in the case of brief quotations embodied in critical reviews and certain other noncommercial uses permitted by copyright law.\n\nISBN: XXX-X-XXXXXX-XX-X (Paperback)\nISBN: XXX-X-XXXXXX-XX-X (eBook)\n\nFirst Edition: 2026"}},
                {"id": "ms-dedication", "type": "heading", "content": {"text": "Dedication", "level": 2}},
                {"id": "ms-dedication-body", "type": "paragraph", "content": {"text": "To [person/people], whose unwavering support made this work possible."}},
                {"id": "ms-toc", "type": "heading", "content": {"text": "Table of Contents", "level": 2}},
                {"id": "ms-toc-body", "type": "paragraph", "content": {"text": "Introduction .......................................................... 1\nChapter 1: [Chapter Title] .................................. 5\nChapter 2: [Chapter Title] ................................ 23\nChapter 3: [Chapter Title] ................................ 47\nChapter 4: [Chapter Title] ................................ 72\nChapter 5: [Chapter Title] ................................ 98\nConclusion ........................................................ 125\nAcknowledgements .............................................. 131\nAppendix A: [Title] .......................................... 135\nIndex ................................................................ 142"}},
                {"id": "ms-intro", "type": "heading", "content": {"text": "Introduction", "level": 2}},
                {"id": "ms-intro-body", "type": "paragraph", "content": {"text": "This book explores [central theme] through the lens of [framework/perspective]. Drawing on [research/experience], it aims to provide readers with a comprehensive understanding of [subject] and practical insights for [application]. The book is organized into [number] chapters, each building upon the previous to create a coherent narrative arc."}},
                {"id": "ms-ch1", "type": "heading", "content": {"text": "Chapter 1: [Chapter Title]", "level": 2}},
                {"id": "ms-ch1-body", "type": "paragraph", "content": {"text": "The first chapter establishes the foundational concepts necessary for understanding [topic]. We begin by examining [key concept], tracing its evolution from [historical origin] to its current form. This historical context is essential for appreciating why [modern implication] matters today.\n\nKey themes explored in this chapter:\n• The origins and development of [concept]\n• Core principles and their practical applications\n• Common misconceptions and how to avoid them\n• Case studies illustrating successful implementation\n\nAs we will see throughout this book, the key to mastering [subject] lies not in memorizing rules but in developing a deep intuition for [core principle]."}},
                {"id": "ms-ch2", "type": "heading", "content": {"text": "Chapter 2: [Chapter Title]", "level": 2}},
                {"id": "ms-ch2-body", "type": "paragraph", "content": {"text": "Building on the foundation established in Chapter 1, we now turn our attention to [advanced topic]. This chapter presents a detailed framework for [approach], supported by evidence from [sources].\n\nThe framework consists of four interconnected components:\n1. [Component 1] — The foundation layer\n2. [Component 2] — The structural layer\n3. [Component 3] — The operational layer\n4. [Component 4] — The optimization layer\n\nEach component is examined through the lens of [criteria], with real-world examples drawn from [industry/domain]."}},
                {"id": "ms-acknowledgements", "type": "heading", "content": {"text": "Acknowledgements", "level": 2}},
                {"id": "ms-acknowledgements-body", "type": "paragraph", "content": {"text": "This book would not have been possible without the support and guidance of many people. I am deeply grateful to [mentor/advisor] for their invaluable feedback and encouragement throughout this project. Special thanks to [colleagues/friends] who reviewed drafts and provided critical insights. Finally, I wish to thank my family for their patience and understanding during the countless hours spent writing and revising."}},
                {"id": "ms-about-author", "type": "heading", "content": {"text": "About the Author", "level": 2}},
                {"id": "ms-about-author-body", "type": "paragraph", "content": {"text": "[Author Name] is a [title/role] with [X] years of experience in [field]. They have [notable achievements] and their work has been featured in [publications/platforms]. This is their first/second book. They live in [location] with [family details]."}},
            ],
            "styles": {"font": "Inter", "body_size": 11, "heading_font": "Inter", "primary_color": "#000000"},
        },
    }

    template_data = MODELS.get(template_id)
    if template_data:
        return template_data

    return {
        "meta": {
            "title": fallback["title"],
            "layout_mode": "editable",
            "template_id": template_id,
        },
        "blocks": [
            {"id": "block-1", "type": "heading", "content": {"text": fallback["title"], "level": 1}},
            {"id": "block-2", "type": "paragraph", "content": {"text": fallback["description"]}},
            {"id": "block-3", "type": "heading", "content": {"text": "Section 1", "level": 2}},
            {"id": "block-4", "type": "paragraph", "content": {"text": "Start writing your content here. This template provides a structural foundation for your document."}},
            {"id": "block-5", "type": "heading", "content": {"text": "Section 2", "level": 2}},
            {"id": "block-6", "type": "paragraph", "content": {"text": "Add more sections as needed."}},
        ],
        "styles": {"font": "Inter", "body_size": 11, "heading_font": "Inter", "primary_color": "#000000"},
    }


def _normalize_template_model(model: dict) -> dict:
    normalized = {**model, "blocks": []}
    for block in model.get("blocks", []):
        next_block = {**block}
        content = next_block.get("content")
        if isinstance(content, dict):
            next_block["content"] = str(content.get("text") or "")
            level = content.get("level")
            if next_block.get("type") == "heading":
                next_block["type"] = f"heading{level}" if level in (1, 2, 3) else "heading1"
        elif content is None:
            next_block["content"] = ""
        else:
            next_block["content"] = str(content)
        normalized["blocks"].append(next_block)
    normalized.setdefault("page_dimensions", [])
    normalized.setdefault("styles", {})
    return normalized

@router.get("/{template_id}/preview")
async def preview_template(template_id: str):
    fallback = next((t for t in FALLBACK_TEMPLATES if t["id"] == template_id), None)
    model = _build_template_model(template_id)
    if not model:
        raise HTTPException(status_code=404, detail="Template not found")
    return {
        "id": template_id,
        "title": fallback["title"] if fallback else "Template",
        "category": fallback["category"] if fallback else "General",
        "description": fallback["description"] if fallback else "",
        "author": fallback["author"] if fallback else "OLPDF Studio",
        "block_count": len(model["blocks"]),
        "sections": [b for b in model["blocks"] if b["type"] == "heading"],
        "styles": model.get("styles", {}),
        "uses_count": fallback["uses_count"] if fallback else 0,
    }

@router.post("/{template_id}/apply")
async def apply_template(
    template_id: str,
    workspace_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    user_id = _user_id(current_user)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Satisfy documents.user_id -> profiles.id FK (matches create_document flow).
    ensure_profile_row(current_user)

    title = "Untitled"
    document_model = None

    # Try DB first — use .limit(1) not .single() so 0 rows doesn't raise an error
    try:
        template_res = supabase.table("templates").select("*").eq("id", template_id).limit(1).execute()
        template_data = template_res.data[0] if template_res.data else None
    except Exception:
        template_data = None

    if template_data:
        document_model = template_data.get("document_model")
        title = f"New from {template_data['title']}"
        try:
            supabase.table("templates").update({
                "uses_count": template_data.get("uses_count", 0) + 1
            }).eq("id", template_id).execute()
        except Exception:
            pass
    else:
        # Fallback to built-in template
        fallback = _build_template_model(template_id)
        if not fallback:
            raise HTTPException(status_code=404, detail="Template not found")
        document_model = fallback
        title = f"New from {fallback['meta']['title']}"

    if not document_model:
        raise HTTPException(status_code=500, detail="Template has no document model")

    document_model = _normalize_template_model(document_model)
    new_doc = DocumentRepository.create(title, document_model, user_id=user_id, workspace_id=workspace_id)

    if not new_doc:
        raise HTTPException(status_code=500, detail="Failed to create document from template")

    return {"document_id": new_doc["id"]}
