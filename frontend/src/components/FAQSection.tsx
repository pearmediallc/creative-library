import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
  category: 'general' | 'buyers' | 'creatives';
}

const faqData: FAQItem[] = [
  // General
  {
    question: "How do I create a new request?",
    answer: "Click 'Create Request' button on the File Requests or Launch Requests page. Fill in the required details including title, type, number of creatives, platforms, and verticals.",
    category: 'general'
  },
  {
    question: "How do I edit a request?",
    answer: "Open the request details modal and click the Edit icon (pencil). Make your changes and click Save. All users can edit requests that are not closed or launched.",
    category: 'general'
  },
  {
    question: "What is Canvas Brief?",
    answer: "Canvas Brief is a 3-step form to clearly define your creative requirements: Product Description, Problem Statement, and Key Features. It helps creative teams understand exactly what you need.",
    category: 'general'
  },

  // Buyers
  {
    question: "How do I download media files?",
    answer: "Click the Download button on any media file. You'll see two options: 'Download Original' (with metadata) or 'Download Clean' (metadata stripped). Choose based on your needs.",
    category: 'buyers'
  },
  {
    question: "What's the difference between downloading with and without metadata?",
    answer: "Original files include EXIF data like camera info, location, timestamps. Clean files have all metadata stripped for privacy or platform requirements.",
    category: 'buyers'
  },
  {
    question: "How do I assign files to campaigns?",
    answer: "In the Media Library, select files and use the bulk actions menu to organize them into folders or add tags for easy tracking.",
    category: 'buyers'
  },

  // Creatives
  {
    question: "How do I upload files to a request?",
    answer: "Open the request, drag and drop files into the upload area, or click to browse. You can upload multiple files at once. Add comments to provide context.",
    category: 'creatives'
  },
  {
    question: "Can I see my progress on requests?",
    answer: "Yes! Each request shows a progress bar indicating how many creatives you've completed out of the total assigned to you.",
    category: 'creatives'
  },
  {
    question: "What file formats are supported?",
    answer: "Images: JPG, PNG, GIF, WebP. Videos: MP4, MOV, WebM. Maximum file size is 100MB. Larger files may need to be compressed.",
    category: 'creatives'
  }
];

interface FAQSectionProps {
  userRole?: 'admin' | 'team_lead' | 'buyer' | 'creative';
}

export function FAQSection({ userRole }: FAQSectionProps) {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<'all' | 'general' | 'buyers' | 'creatives'>('all');

  const toggleItem = (index: number) => {
    const newOpen = new Set(openItems);
    if (newOpen.has(index)) {
      newOpen.delete(index);
    } else {
      newOpen.add(index);
    }
    setOpenItems(newOpen);
  };

  const filteredFAQs = filter === 'all'
    ? faqData
    : faqData.filter(faq => faq.category === filter || faq.category === 'general');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Frequently Asked Questions
        </h2>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('general')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'general'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          General
        </button>
        <button
          onClick={() => setFilter('buyers')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'buyers'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          For Buyers
        </button>
        <button
          onClick={() => setFilter('creatives')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'creatives'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          For Creatives
        </button>
      </div>

      {/* FAQ Items */}
      <div className="space-y-2">
        {filteredFAQs.map((faq, index) => (
          <div
            key={index}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggleItem(index)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span className="font-medium text-gray-900 dark:text-white pr-4">
                {faq.question}
              </span>
              {openItems.has(index) ? (
                <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
              )}
            </button>
            {openItems.has(index) && (
              <div className="px-4 pb-4 text-gray-600 dark:text-gray-400">
                {faq.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
