'use client'

import { useTranslations } from 'next-intl'
import type { WizardStepIndex } from './wizardTypes'

interface StepperProps {
  current: WizardStepIndex
  onStepClick?: (i: WizardStepIndex) => void
}

const STEP_KEYS = ['scan', 'connect', 'preview', 'deploy', 'result'] as const

export default function Stepper({ current, onStepClick }: StepperProps) {
  const t = useTranslations('marketingSetup')

  const steps = STEP_KEYS.map((key, idx) => ({
    index: idx as WizardStepIndex,
    label: t(`steps.${key}`),
  }))

  // Progress bar fills proportionally to the active step (0%..100%).
  const currentPercent =
    steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0

  return (
    <div className="mb-8">
      <div className="relative flex justify-between items-center mb-3">
        {steps.map(({ index, label }) => {
          const isDone = index < current
          const isActive = index === current
          const clickable = Boolean(onStepClick) && index <= current
          return (
            <div
              key={index}
              onClick={() => clickable && onStepClick?.(index)}
              className={`relative flex flex-col items-center flex-1 min-w-0 ${
                clickable ? 'cursor-pointer' : ''
              }`}
            >
              <div
                className={`
                  w-10 h-10 text-sm rounded-full flex items-center justify-center font-bold transition-all duration-300
                  ${
                    isDone
                      ? 'bg-primary shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.18)] text-white'
                      : isActive
                      ? 'bg-white border-2 border-primary text-primary shadow-[0_0_0_4px_rgba(var(--color-primary-rgb),0.12),0_2px_8px_rgba(0,0,0,0.10)]'
                      : 'bg-white border-2 border-gray-200 text-gray-400 shadow-sm'
                  }
                `}
              >
                {isDone ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`mt-1.5 text-[12px] font-medium text-center whitespace-nowrap transition-colors duration-200 ${
                  isActive
                    ? 'text-primary'
                    : isDone
                    ? 'text-primary/70'
                    : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200/60">
        <div
          className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500 ease-out rounded-full"
          style={{ width: `${currentPercent}%` }}
        />
      </div>
    </div>
  )
}
