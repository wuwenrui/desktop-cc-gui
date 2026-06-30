import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REASONING_LEVELS, type ReasoningEffort } from '../types';
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

interface ReasoningSelectProps {
  value: ReasoningEffort | null;
  onChange: (effort: ReasoningEffort | null) => void;
  options?: ReasoningEffort[];
  showDefaultOption?: boolean;
  defaultLabel?: string;
  disabled?: boolean;
  /**
   * When true, render as a DropdownMenuSub for the vertical tool menu
   * instead of a standalone button + popover.
   */
  inline?: boolean;
}

/**
 * ReasoningSelect - runtime reasoning effort selector.
 * Controls the depth of reasoning for engines that expose an effort option.
 */
export const ReasoningSelect = ({
  value,
  onChange,
  options,
  showDefaultOption = false,
  defaultLabel,
  disabled,
  inline = false,
}: ReasoningSelectProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const visibleLevels = REASONING_LEVELS.filter((level) => {
    if (options === undefined) {
      return true;
    }
    return options.includes(level.id);
  });
  const fallbackLevel = visibleLevels[0] ?? REASONING_LEVELS[0] ?? {
    id: 'medium' as ReasoningEffort,
    label: 'Medium',
    icon: 'codicon-circle-filled',
    description: 'Balanced thinking',
  };

  const currentLevel = value
    ? REASONING_LEVELS.find(l => l.id === value) ?? fallbackLevel
    : null;
  const resolvedDefaultLabel =
    defaultLabel ?? t('reasoning.default', { defaultValue: 'Default' });

  /**
   * Get translated text for reasoning level
   */
  const getReasoningText = (levelId: ReasoningEffort, field: 'label' | 'description') => {
    const key = `reasoning.${levelId}.${field}`;
    const fallback = REASONING_LEVELS.find(l => l.id === levelId)?.[field] || levelId;
    return t(key, { defaultValue: fallback });
  };
  const triggerLabel = currentLevel ? getReasoningText(currentLevel.id, 'label') : resolvedDefaultLabel;
  const triggerIcon = currentLevel?.icon ?? 'codicon-lightbulb';

  /**
   * Toggle dropdown
   */
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setIsOpen(!isOpen);
  }, [isOpen, disabled]);

  /**
   * Select reasoning level
   */
  const handleSelect = useCallback((effort: ReasoningEffort | null) => {
    onChange(effort);
    setIsOpen(false);
  }, [onChange]);

  /**
   * Close on outside click
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (inline) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="composer-tool-menu-sub-trigger">
          <span className={`codicon ${triggerIcon} composer-tool-menu-item-icon`} aria-hidden="true" />
          <span className="composer-tool-menu-item-body">
            <span className="composer-tool-menu-item-label">
              {t('reasoning.title', { defaultValue: '推理深度' })}
            </span>
            <span className="composer-tool-menu-item-value">{triggerLabel}</span>
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="composer-tool-menu-sub-content">
          {showDefaultOption && (
            <button
              type="button"
              className={`composer-tool-menu-option${value === null ? ' is-selected' : ''}`}
              onClick={() => handleSelect(null)}
              title={t('reasoning.defaultDescription', {
                defaultValue: 'Use the engine default reasoning behavior',
              })}
            >
              <span className="codicon codicon-circle-outline composer-tool-menu-option-icon" aria-hidden="true" />
              <span className="composer-tool-menu-option-body">
                <span className="composer-tool-menu-option-label">{resolvedDefaultLabel}</span>
                <span className="composer-tool-menu-option-description">
                  {t('reasoning.defaultDescription', {
                    defaultValue: 'Use the engine default reasoning behavior',
                  })}
                </span>
              </span>
              {value === null && (
                <span className="codicon codicon-check composer-tool-menu-option-check" aria-hidden="true" />
              )}
            </button>
          )}
          {visibleLevels.map((level) => (
            <button
              key={level.id}
              type="button"
              className={`composer-tool-menu-option${level.id === value ? ' is-selected' : ''}`}
              onClick={() => handleSelect(level.id)}
              title={getReasoningText(level.id, 'description')}
            >
              <span className={`codicon ${level.icon} composer-tool-menu-option-icon`} aria-hidden="true" />
              <span className="composer-tool-menu-option-body">
                <span className="composer-tool-menu-option-label">{getReasoningText(level.id, 'label')}</span>
                <span className="composer-tool-menu-option-description">
                  {getReasoningText(level.id, 'description')}
                </span>
              </span>
              {level.id === value && (
                <span className="codicon codicon-check composer-tool-menu-option-check" aria-hidden="true" />
              )}
            </button>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  return (
    <div className="selector-reasoning-wrap" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        className="selector-button selector-reasoning-button"
        onClick={handleToggle}
        disabled={disabled}
        aria-label={triggerLabel}
        title={t('reasoning.title', { defaultValue: 'Select reasoning depth' })}
      >
        <span className={`codicon ${triggerIcon}`} />
        <span className="selector-button-text">{triggerLabel}</span>
        <span
          className={`codicon codicon-chevron-${isOpen ? 'up' : 'down'}`}
          style={{ fontSize: '10px', marginLeft: '2px' }}
        />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="selector-dropdown selector-dropdown--reasoning"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: '4px',
            zIndex: 10000,
          }}
        >
          {showDefaultOption && (
            <div
              className={`selector-option ${value === null ? 'selected' : ''}`}
              onClick={() => handleSelect(null)}
              title={t('reasoning.defaultDescription', {
                defaultValue: 'Use the engine default reasoning behavior',
              })}
            >
              <span className="codicon codicon-circle-outline" />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span>{resolvedDefaultLabel}</span>
                <span className="mode-description">
                  {t('reasoning.defaultDescription', {
                    defaultValue: 'Use the engine default reasoning behavior',
                  })}
                </span>
              </div>
              {value === null && (
                <span className="codicon codicon-check check-mark" />
              )}
            </div>
          )}
          {visibleLevels.map((level) => (
            <div
              key={level.id}
              className={`selector-option selector-option--reasoning ${level.id === value ? 'selected' : ''}`}
              onClick={() => handleSelect(level.id)}
              title={getReasoningText(level.id, 'description')}
            >
              <span className={`codicon ${level.icon}`} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span>{getReasoningText(level.id, 'label')}</span>
                <span className="mode-description">{getReasoningText(level.id, 'description')}</span>
              </div>
              {level.id === value && (
                <span className="codicon codicon-check check-mark" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReasoningSelect;
