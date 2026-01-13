/**
 * Canvas/Product Brief Templates
 * Predefined templates for file request canvas briefs
 */

export interface CanvasBlock {
  type: 'heading' | 'text' | 'list' | 'checklist' | 'attachments';
  level?: number;
  content?: string;
  icon?: string;
  items?: string[] | { text: string; checked: boolean }[];
  placeholder?: string;
}

export interface CanvasContent {
  blocks: CanvasBlock[];
}

export interface CanvasAttachment {
  file_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  thumbnail_url?: string;
  uploaded_at: string;
}

export interface Canvas {
  id?: string;
  file_request_id: string;
  content: CanvasContent;
  attachments: CanvasAttachment[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Product Brief Template
 * Default template matching Slack's Canvas UI
 */
export const PRODUCT_BRIEF_TEMPLATE: CanvasContent = {
  blocks: [
    {
      type: 'heading',
      level: 2,
      content: '👥 The team',
      icon: '👥'
    },
    {
      type: 'text',
      content: 'Leads: use @ to add someone'
    },
    {
      type: 'text',
      content: 'Team members: use @ to add someone'
    },
    {
      type: 'heading',
      level: 2,
      content: '📦 Product description',
      icon: '📦'
    },
    {
      type: 'text',
      content: "Now's your chance to go deep – tell your team what this product's about."
    },
    {
      type: 'heading',
      level: 2,
      content: '⚠️ Problem statement',
      icon: '⚠️'
    },
    {
      type: 'text',
      content: 'Explain the core problem that this product would address.'
    },
    {
      type: 'heading',
      level: 2,
      content: '🔑 Key features',
      icon: '🔑'
    },
    {
      type: 'list',
      items: ['Feature 1', 'Feature 2', 'Feature 3']
    },
    {
      type: 'heading',
      level: 2,
      content: 'Milestones'
    },
    {
      type: 'checklist',
      items: [
        { text: 'Milestone 1 - Date', checked: false },
        { text: 'Milestone 2 - Date', checked: false },
        { text: 'Milestone 3 - Date', checked: false }
      ]
    },
    {
      type: 'heading',
      level: 2,
      content: '💡 Success criteria',
      icon: '💡'
    },
    {
      type: 'text',
      content: 'How will you measure product impact?'
    },
    {
      type: 'heading',
      level: 2,
      content: '⚠️ Challenges and risks',
      icon: '⚠️'
    },
    {
      type: 'text',
      content: 'Identify potential risks and how you plan to mitigate them.'
    },
    {
      type: 'heading',
      level: 2,
      content: '🔗 Resources and appendix',
      icon: '🔗'
    },
    {
      type: 'attachments',
      placeholder: 'Add reference files here'
    }
  ]
};

/**
 * Helper function to create empty canvas
 */
export function createEmptyCanvas(fileRequestId: string): Canvas {
  return {
    file_request_id: fileRequestId,
    content: PRODUCT_BRIEF_TEMPLATE,
    attachments: []
  };
}

/**
 * Helper function to validate canvas content
 */
export function isValidCanvasContent(content: any): content is CanvasContent {
  return (
    content &&
    typeof content === 'object' &&
    Array.isArray(content.blocks) &&
    content.blocks.every((block: any) =>
      block && typeof block === 'object' && typeof block.type === 'string'
    )
  );
}
