/**
 * Input Validator - API 요청 데이터 검증
 * 
 * 역할:
 * - 입력 데이터 타입 검증
 * - 길이 제한 검증
 * - 패턴 검증 (SQL injection, XSS 방지)
 * - 필수 필드 검증
 */

class InputValidator {
  constructor(options = {}) {
    this.maxStringLength = options.maxStringLength || 1000;
    this.maxArrayLength = options.maxArrayLength || 100;
    this.maxObjectSize = options.maxObjectSize || 50;

    // 위험한 패턴 (SQL injection, XSS 등)
    this.dangerousPatterns = [
      /(\bOR\b|\bAND\b|--|;|\/\*|\*\/|\xdbunion\b)/gi,
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\(/gi,
      /expression\(/gi
    ];
  }

  /**
   * 문자열 검증
   */
  validateString(value, options = {}) {
    const { required = false, minLength = 0, maxLength = this.maxStringLength, pattern = null } = options;

    if (value === null || value === undefined) {
      if (required) {
        return { valid: false, error: '필수 필드입니다' };
      }
      return { valid: true };
    }

    if (typeof value !== 'string') {
      return { valid: false, error: '문자열이어야 합니다' };
    }

    if (value.length < minLength || value.length > maxLength) {
      return {
        valid: false,
        error: `길이는 ${minLength}~${maxLength} 범위여야 합니다`
      };
    }

    if (pattern && !pattern.test(value)) {
      return { valid: false, error: '유효한 형식이 아닙니다' };
    }

    return { valid: true };
  }

  /**
   * 숫자 검증
   */
  validateNumber(value, options = {}) {
    const { required = false, min = 0, max = Infinity, integer = false } = options;

    if (value === null || value === undefined) {
      if (required) {
        return { valid: false, error: '필수 필드입니다' };
      }
      return { valid: true };
    }

    if (typeof value !== 'number' || isNaN(value)) {
      return { valid: false, error: '숫자여야 합니다' };
    }

    if (integer && !Number.isInteger(value)) {
      return { valid: false, error: '정수여야 합니다' };
    }

    if (value < min || value > max) {
      return {
        valid: false,
        error: `값은 ${min}~${max} 범위여야 합니다`
      };
    }

    return { valid: true };
  }

  /**
   * 배열 검증
   */
  validateArray(value, options = {}) {
    const { required = false, maxLength = this.maxArrayLength, itemType = null } = options;

    if (value === null || value === undefined) {
      if (required) {
        return { valid: false, error: '필수 필드입니다' };
      }
      return { valid: true };
    }

    if (!Array.isArray(value)) {
      return { valid: false, error: '배열이어야 합니다' };
    }

    if (value.length > maxLength) {
      return {
        valid: false,
        error: `배열 길이는 ${maxLength} 이하여야 합니다`
      };
    }

    // 각 항목 타입 검증
    if (itemType) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] !== itemType) {
          return {
            valid: false,
            error: `항목 ${i}은 ${itemType} 타입이어야 합니다`
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * 객체 검증
   */
  validateObject(value, schema) {
    if (typeof value !== 'object' || value === null) {
      return { valid: false, error: '객체여야 합니다' };
    }

    const keys = Object.keys(value);
    if (keys.length > this.maxObjectSize) {
      return {
        valid: false,
        error: `객체 크기는 ${this.maxObjectSize} 이하여야 합니다`
      };
    }

    // 스키마 검증
    for (const [field, fieldSchema] of Object.entries(schema)) {
      const fieldValue = value[field];
      const validator = fieldSchema.validator || (() => ({ valid: true }));

      const result = validator(fieldValue, fieldSchema);
      if (!result.valid) {
        return { valid: false, error: `${field}: ${result.error}` };
      }
    }

    return { valid: true };
  }

  /**
   * 위험한 콘텐츠 검사
   */
  isSafe(value) {
    if (typeof value !== 'string') {
      return true;
    }

    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 검색 쿼리 검증
   */
  validateSearchQuery(query) {
    // 필수 검증
    const stringCheck = this.validateString(query, {
      required: true,
      minLength: 1,
      maxLength: 1000
    });

    if (!stringCheck.valid) {
      return stringCheck;
    }

    // 안전성 검증
    if (!this.isSafe(query)) {
      return { valid: false, error: '유효하지 않은 문자가 포함되어 있습니다' };
    }

    return { valid: true };
  }

  /**
   * 3단어 쿼리 검증
   */
  validateThreeWordQuery(words) {
    // 배열 검증
    const arrayCheck = this.validateArray(words, {
      required: true,
      maxLength: 10,
      itemType: 'string'
    });

    if (!arrayCheck.valid) {
      return arrayCheck;
    }

    // 각 단어 검증
    for (let i = 0; i < words.length; i++) {
      const wordCheck = this.validateString(words[i], {
        required: true,
        minLength: 1,
        maxLength: 50
      });

      if (!wordCheck.valid) {
        return { valid: false, error: `단어 ${i}: ${wordCheck.error}` };
      }

      if (!this.isSafe(words[i])) {
        return { valid: false, error: `단어 ${i}: 유효하지 않은 문자` };
      }
    }

    return { valid: true };
  }

  /**
   * Webhook 페이로드 검증
   */
  validateWebhookPayload(payload) {
    const schema = {
      action: {
        validator: (value) => this.validateString(value, {
          required: true,
          pattern: /^(push|create|delete)$/
        })
      },
      repository: {
        validator: (value) => this.validateObject(value, {
          id: { validator: (v) => this.validateNumber(v, { required: true, integer: true }) },
          full_name: { validator: (v) => this.validateString(v, { required: true }) },
          clone_url: { validator: (v) => this.validateString(v, { required: true }) }
        })
      }
    };

    return this.validateObject(payload, schema);
  }

  /**
   * 전체 검증 보고서
   */
  getReport() {
    return {
      maxStringLength: this.maxStringLength,
      maxArrayLength: this.maxArrayLength,
      maxObjectSize: this.maxObjectSize,
      dangerousPatternsCount: this.dangerousPatterns.length,
      validators: ['String', 'Number', 'Array', 'Object', 'SearchQuery', 'ThreeWordQuery', 'WebhookPayload']
    };
  }
}

export default InputValidator;
