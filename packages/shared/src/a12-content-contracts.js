/**
 * DTH-A12 Content Autopilot contracts.
 * AI output is candidate only. No live social/AI. No 9th KillDomain.
 * LIVE_AI_CALLS_A12=0 LIVE_SOCIAL_PROVIDER_CALLS=0 LIVE_CONTENT_PUBLICATIONS=0.
 */

export const A12_STRATEGY_POLICY_ID = 'ContentStrategyPolicyV1';
export const A12_STRATEGY_POLICY_VERSION = 1;
export const A12_BRAND_POLICY_ID = 'BrandPolicyV1';
export const A12_BRAND_POLICY_VERSION = 1;
export const A12_RISK_POLICY_ID = 'ContentRiskPolicyV1';
export const A12_RISK_POLICY_VERSION = 1;
export const A12_APPROVAL_POLICY_ID = 'ContentApprovalPolicyV1';
export const A12_APPROVAL_POLICY_VERSION = 1;
export const A12_TEST_GENERATOR_ID = 'DeterministicTestContentGenerator';
export const A12_TEST_PUBLISHER_ID = 'DeterministicTestPublishingProvider';

export const LIVE_AI_CALLS_A12 = 0;
export const LIVE_SOCIAL_PROVIDER_CALLS = 0;
export const LIVE_CONTENT_PUBLICATIONS = 0;

export const STAGING_CONTENT_AUTONOMY_READY = false;
export const PRODUCTION_CONTENT_AUTONOMY_READY = false;
export const STAGING_AUTONOMY_READY_A12 = false;
export const PRODUCTION_AUTONOMY_READY_A12 = false;

export const OWNER_CONTENT_STRATEGY_POLICY_REQUIRED = true;
export const OWNER_CONTENT_PUBLISHING_PROVIDER_REQUIRED = true;
export const OWNER_CONTENT_AI_PROVIDER_REQUIRED = true;
export const OWNER_CONTENT_AUTOPUBLISH_POLICY_REQUIRED = true;

export const CONTENT_PUBLICATION_DUE_CAPABILITY = 'CONTENT_PUBLICATION_DUE';
export const CONTENT_RECONCILE_CAPABILITY = 'CONTENT_RECONCILE';
export const CONTENT_METRICS_REFRESH_CAPABILITY = 'CONTENT_METRICS_REFRESH';

/** Documented kill mapping — not a 9th domain. */
export const ContentKillDomain = 'AUTOMATION_ENGINE';

export const ContentPurpose = Object.freeze({
  EDUCATION: 'EDUCATION',
  PROBLEM_AWARENESS: 'PROBLEM_AWARENESS',
  ENERGY_COST_GUIDANCE: 'ENERGY_COST_GUIDANCE',
  PROCESS_EXPLANATION: 'PROCESS_EXPLANATION',
  TRUST: 'TRUST',
  PRODUCT_EXPLANATION: 'PRODUCT_EXPLANATION',
  FAQ: 'FAQ',
});

export const ContentAudience = Object.freeze({
  SME_OWNER: 'SME_OWNER',
  OPERATIONS_MANAGER: 'OPERATIONS_MANAGER',
  MULTI_SITE_BUSINESS: 'MULTI_SITE_BUSINESS',
  ENERGY_COST_RESPONSIBLE: 'ENERGY_COST_RESPONSIBLE',
});

/** E2 synthetic channels only. No live LinkedIn/blog providers. */
export const ContentChannel = Object.freeze({
  SYNTHETIC_LINKEDIN: 'SYNTHETIC_LINKEDIN',
  SYNTHETIC_BLOG: 'SYNTHETIC_BLOG',
});

export const ContentStatus = Object.freeze({
  DRAFT: 'DRAFT',
  VALIDATION_REQUIRED: 'VALIDATION_REQUIRED',
  BLOCKED: 'BLOCKED',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  APPROVED: 'APPROVED',
  SCHEDULED: 'SCHEDULED',
  PUBLICATION_PENDING: 'PUBLICATION_PENDING',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
  OUTCOME_UNKNOWN: 'OUTCOME_UNKNOWN',
  CANCELLED: 'CANCELLED',
  SUPERSEDED: 'SUPERSEDED',
});

export const ClaimType = Object.freeze({
  SAVINGS: 'SAVINGS',
  TARIFF_AS_LIVE: 'TARIFF_AS_LIVE',
  TESTIMONIAL: 'TESTIMONIAL',
  SUPERLATIVE: 'SUPERLATIVE',
  LEGAL: 'LEGAL',
  PROCESS: 'PROCESS',
  EDUCATION: 'EDUCATION',
  PRODUCT: 'PRODUCT',
  LINK: 'LINK',
  OTHER: 'OTHER',
});

export const ClaimState = Object.freeze({
  SUPPORTED: 'SUPPORTED',
  UNSUPPORTED: 'UNSUPPORTED',
  UNKNOWN: 'UNKNOWN',
  PROHIBITED: 'PROHIBITED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
});

export const ContentRiskClass = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  BLOCKED: 'BLOCKED',
});

export const ContentApprovalDecision = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export const ContentIntentState = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  CREATED: 'CREATED',
  ATTEMPTED: 'ATTEMPTED',
  PROVIDER_ACCEPTED: 'PROVIDER_ACCEPTED',
  OUTCOME_UNKNOWN: 'OUTCOME_UNKNOWN',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});

export const ContentPublicationState = Object.freeze({
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
  OUTCOME_UNKNOWN: 'OUTCOME_UNKNOWN',
  MISMATCH: 'MISMATCH',
  ABSENT: 'ABSENT',
  CANCELLED: 'CANCELLED',
});

export const ContentGeneratorMode = Object.freeze({
  SAFE_EDUCATION: 'SAFE_EDUCATION',
  UNSUPPORTED_SAVINGS: 'UNSUPPORTED_SAVINGS',
  SYNTHETIC_TARIFF_AS_LIVE: 'SYNTHETIC_TARIFF_AS_LIVE',
  FAKE_TESTIMONIAL: 'FAKE_TESTIMONIAL',
  MARKET_SUPERLATIVE: 'MARKET_SUPERLATIVE',
  HIGH_RISK_SUPPORTED: 'HIGH_RISK_SUPPORTED',
  PROMPT_INJECTION: 'PROMPT_INJECTION',
  UNAPPROVED_LINK: 'UNAPPROVED_LINK',
  XSS_PAYLOAD: 'XSS_PAYLOAD',
});

export const ALLOWED_CONTENT_DOMAINS = Object.freeze([
  'deintarifheld.de',
  'www.deintarifheld.de',
]);

export const FORBIDDEN_CLAIM_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'SAVINGS_PERCENT_OR_EURO',
    claimType: ClaimType.SAVINGS,
    claimState: ClaimState.PROHIBITED,
    re: String.raw`(spar(en|nis|t)|%\s*(weniger|günstiger)|garantiert\s+günstiger|\d+\s*%|\d+[\.,]?\d*\s*€\s*gespart)`,
  }),
  Object.freeze({
    id: 'TARIFF_AS_LIVE',
    claimType: ClaimType.TARIFF_AS_LIVE,
    claimState: ClaimState.PROHIBITED,
    re: String.raw`(live[- ]?tarif|echter\s+(lieferbarer\s+)?tarif|aktueller\s+live[- ]?tarif|nicht\s+synthetisch)`,
  }),
  Object.freeze({
    id: 'FAKE_TESTIMONIAL',
    claimType: ClaimType.TESTIMONIAL,
    claimState: ClaimState.PROHIBITED,
    re: String.raw`(testimonial|kunde\s+\w+\s+sagt|„[^"]{8,}“|"[^"]{8,}"\s*sagt)`,
  }),
  Object.freeze({
    id: 'MARKET_SUPERLATIVE',
    claimType: ClaimType.SUPERLATIVE,
    claimState: ClaimState.PROHIBITED,
    re: String.raw`(günstigste[rs]?|beste[rs]?|marktführer|#\s*1|nummer\s+eins|einzigartig)`,
  }),
  Object.freeze({
    id: 'LEGAL_ADVICE',
    claimType: ClaimType.LEGAL,
    claimState: ClaimState.PROHIBITED,
    re: String.raw`(rechtsberatung|anwaltlich|garantiert\s+rechtlich|wir\s+raten\s+rechtlich)`,
  }),
  Object.freeze({
    id: 'PROMPT_INJECTION',
    claimType: ClaimType.OTHER,
    claimState: ClaimState.PROHIBITED,
    re: String.raw`(ignore\s+all\s+previous|override\s+policy|system:\s*set\s+claim)`,
  }),
]);

export const BRAND_RULES_V1 = Object.freeze({
  canonicalName: 'DeinTarifheld',
  allowedNameVariants: Object.freeze(['DeinTarifheld', 'deinTarifheld']),
  forbiddenNamePatterns: Object.freeze([
    'Dein Tarif Held',
    'DeinTarifHeld LIVE',
    'Tarifheld GmbH live',
  ]),
  allowedDomains: ALLOWED_CONTENT_DOMAINS,
  maxHashtags: 3,
  allowedCtaPatterns: Object.freeze([
    'Mehr zum Ablauf',
    'Ablauf erfahren',
    'Prozess erklären',
    'FAQ lesen',
  ]),
  forbiddenCtaPatterns: Object.freeze([
    'Jetzt sparen',
    'Garantiert wechseln',
    'Sofort buchen',
    'Live-Tarif abschließen',
  ]),
});

export const ContentStrategyPolicyV1 = Object.freeze({
  id: A12_STRATEGY_POLICY_ID,
  version: A12_STRATEGY_POLICY_VERSION,
  environment: 'E2_LOCAL_SYNTHETIC',
  allowedPurposes: Object.freeze(Object.values(ContentPurpose)),
  allowedAudiences: Object.freeze(Object.values(ContentAudience)),
  allowedChannels: Object.freeze(Object.values(ContentChannel)),
  liveChannelsAllowed: false,
  autoPublish: false,
  aiIsCandidateOnly: true,
  syntheticTariffAsLiveForbidden: true,
  fakeTestimonialsForbidden: true,
});

export const BrandPolicyV1 = Object.freeze({
  id: A12_BRAND_POLICY_ID,
  version: A12_BRAND_POLICY_VERSION,
  ...BRAND_RULES_V1,
});

export const ContentRiskPolicyV1 = Object.freeze({
  id: A12_RISK_POLICY_ID,
  version: A12_RISK_POLICY_VERSION,
  prohibitedClaimStates: Object.freeze([ClaimState.PROHIBITED, ClaimState.UNSUPPORTED]),
  highRiskRequiresApproval: true,
  blockedNeverPublishes: true,
});

export const ContentApprovalPolicyV1 = Object.freeze({
  id: A12_APPROVAL_POLICY_ID,
  version: A12_APPROVAL_POLICY_VERSION,
  requireApproval: true,
  autoApproveRiskClasses: Object.freeze([ContentRiskClass.LOW]),
  bindToRevisionAndHashAndPolicy: true,
  staleApprovalReuseForbidden: true,
});
