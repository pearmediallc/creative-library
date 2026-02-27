import React, { useState } from 'react';
import { X } from 'lucide-react';

interface CanvasBrief3StepProps {
  requestId: string;
  initialContent?: string;
  onSave: (content: any) => void;
  onClose: () => void;
}

export function CanvasBrief3Step({ requestId, initialContent, onSave, onClose }: CanvasBrief3StepProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Parse initial content if exists
  const parsedInitial = initialContent ? JSON.parse(initialContent) : {};

  const [productDescription, setProductDescription] = useState(
    parsedInitial.product_description || ''
  );
  const [problemStatement, setProblemStatement] = useState(
    parsedInitial.problem_statement || ''
  );
  const [keyFeatures, setKeyFeatures] = useState<string[]>(
    parsedInitial.key_features || ['', '', '']
  );

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...keyFeatures];
    newFeatures[index] = value;
    setKeyFeatures(newFeatures);
  };

  const addFeature = () => {
    setKeyFeatures([...keyFeatures, '']);
  };

  const removeFeature = (index: number) => {
    if (keyFeatures.length > 1) {
      setKeyFeatures(keyFeatures.filter((_, i) => i !== index));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    const content = JSON.stringify({
      product_description: productDescription,
      problem_statement: problemStatement,
      key_features: keyFeatures.filter(f => f.trim())
    });

    await onSave(content);
    setIsSaving(false);
  };

  const steps = [
    {
      number: 1,
      title: 'Product Description',
      description: "What is this product about?"
    },
    {
      number: 2,
      title: 'Problem Statement',
      description: "What core problem does this product address?"
    },
    {
      number: 3,
      title: 'Key Features',
      description: "List the main features (benefits) of the product"
    }
  ];

  const canProceed = () => {
    if (currentStep === 1) return productDescription.trim().length > 0;
    if (currentStep === 2) return problemStatement.trim().length > 0;
    if (currentStep === 3) return keyFeatures.some(f => f.trim().length > 0);
    return false;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Canvas Brief
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Step {currentStep} of 3
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step) => (
              <div
                key={step.number}
                className={`flex-1 h-2 rounded ${
                  step.number < currentStep
                    ? 'bg-green-500'
                    : step.number === currentStep
                    ? 'bg-blue-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                } ${step.number < steps.length ? 'mr-2' : ''}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            {steps.map((step) => (
              <span
                key={step.number}
                className={`flex-1 ${
                  step.number === currentStep ? 'font-semibold text-blue-600 dark:text-blue-400' : ''
                }`}
              >
                {step.title}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Product Description */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  📦 {steps[0].title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {steps[0].description}
                </p>
              </div>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={8}
                placeholder="Describe your product in detail. Tell your team what this product is about..."
              />
            </div>
          )}

          {/* Step 2: Problem Statement */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  ⚠️ {steps[1].title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {steps[1].description}
                </p>
              </div>
              <textarea
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={8}
                placeholder="Explain the core problem that this product would address..."
              />
            </div>
          )}

          {/* Step 3: Key Features */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  🔑 {steps[2].title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {steps[2].description}
                </p>
              </div>
              {keyFeatures.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full text-sm font-semibold">
                    {index + 1}
                  </div>
                  <input
                    type="text"
                    value={feature}
                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                    className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`Feature ${index + 1}`}
                  />
                  {keyFeatures.length > 1 && (
                    <button
                      onClick={() => removeFeature(index)}
                      className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Remove feature"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addFeature}
                className="mt-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                + Add Another Feature
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              if (currentStep > 1) setCurrentStep(currentStep - 1);
              else onClose();
            }}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>

          <div className="flex items-center gap-2">
            {currentStep < 3 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceed()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving || !canProceed()}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Canvas Brief'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
