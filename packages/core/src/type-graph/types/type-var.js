// @flow
import { Type } from "./type";
import { THIS_TYPE } from "../constants";
import type { TypeMeta } from "./type";
import type { TypeScope } from "../type-scope";

export class TypeVar extends Type {
  static Self = new TypeVar(THIS_TYPE);

  static isSelf(type: Type) {
    return type.isSubtypeOf === this.Self;
  }

  static createSelf(name: mixed, parent: TypeScope) {
    // $FlowIssue
    return new this(name, { parent, isSubtypeOf: TypeVar.Self });
  }

  constraint: Type | void;
  root: Type | void;
  _isUserDefined: ?boolean;
  priority = 0;

  get isUserDefined() {
    return this._isUserDefined;
  }

  set isUserDefined(isUserDefined: boolean) {
    this._isUserDefined = this._isUserDefined || isUserDefined;
  }

  constructor(
    name: string,
    meta?: TypeMeta = {},
    constraint: Type | void,
    isUserDefined?: boolean = false
  ) {
    super(name, meta);
    this.name = name;
    this.constraint = constraint;
    this._isUserDefined = isUserDefined;
  }

  equalsTo(
    anotherType: Type,
    strict?: boolean = false,
    withoutRoot?: boolean = false
  ) {
    const isDifferenceInDefinition =
      this.isUserDefined &&
      anotherType instanceof TypeVar &&
      !anotherType.isUserDefined &&
      !strict;
    if (isDifferenceInDefinition || this.referenceEqualsTo(anotherType)) {
      return true;
    }
    if (this.root != undefined) {
      // $FlowIssue
      return this.root.equalsTo(anotherType, strict, withoutRoot);
    }
    if (
      anotherType instanceof TypeVar &&
      anotherType.constraint !== undefined &&
      this.constraint !== undefined
    ) {
      return (
        (super.equalsTo(anotherType) &&
          // $FlowIssue
          this.constraint.equalsTo(anotherType.constraint)) ||
        // $FlowIssue
        this.constraint.equalsTo(anotherType)
      );
    }
    return (
      anotherType instanceof TypeVar &&
      this.constraint === anotherType.constraint &&
      super.equalsTo(anotherType)
    );
  }

  isSuperTypeFor(type: Type): boolean {
    if (this.root !== undefined) {
      return this.root.isSuperTypeFor(type);
    }
    if (this.constraint === undefined) {
      return true;
    }
    return this.constraint.isPrincipalTypeFor(type);
  }

  changeAll(
    sourceTypes: Array<Type>,
    targetTypes: Array<Type>,
    typeScope: TypeScope
  ): Type {
    const indexOfNewRootType = sourceTypes.findIndex(
      // $FlowIssue
      a => a.equalsTo(this, true, true)
    );
    if (indexOfNewRootType !== -1) {
      return targetTypes[indexOfNewRootType];
    }
    if (this.root !== undefined) {
      return this.root.changeAll(sourceTypes, targetTypes, typeScope);
    }
    if (this.constraint !== undefined) {
      const newConstraint = this.constraint.changeAll(
        sourceTypes,
        targetTypes,
        typeScope
      );
      if (newConstraint !== this.constraint) {
        return new TypeVar(
          String(this.name),
          { parent: this.parent },
          newConstraint
        );
      }
    }
    return this;
  }

  applyGeneric() {
    return this;
  }

  getDifference(type: Type, withReverseUnion?: boolean = false) {
    if (this._alreadyProcessedWith === type || this.referenceEqualsTo(type)) {
      return [];
    }
    this._alreadyProcessedWith = type;
    let result = [];
    if (this.root !== undefined) {
      result = this.root.getDifference(type, withReverseUnion);
    } else if (type instanceof TypeVar && this !== type) {
      result = [{ root: this, variable: type }];
    } else if ("variants" in type) {
      result = super.getDifference(type, withReverseUnion);
    }
    this._alreadyProcessedWith = null;
    return result;
  }

  contains(type: Type) {
    return (
      (this.constraint != undefined && this.constraint.contains(type)) ||
      this.equalsTo(type, true, true)
    );
  }

  getPropertyType(propertyName: mixed) {
    const target = this.root || this.constraint;
    if (target !== undefined) {
      return target.getPropertyType(propertyName);
    }
    return super.getPropertyType(propertyName);
  }

  getNextParent(typeScope: TypeScope) {
    if (this._alreadyProcessedWith !== null) {
      return Type.GlobalTypeScope;
    }
    this._alreadyProcessedWith = this;
    if (this.root !== undefined || this.constraint !== undefined) {
      const target = this.root || this.constraint;
      // $FlowIssue
      const result = target.getNextParent(typeScope);
      this._alreadyProcessedWith = null;
      return result;
    }
    this._alreadyProcessedWith = null;
    if (
      this.parent.priority <= typeScope.priority &&
      this.parent !== typeScope
    ) {
      return this.parent;
    }
    return Type.GlobalTypeScope;
  }
}
