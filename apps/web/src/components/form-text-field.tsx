import { Input } from "@content-desk/ui/components/input";
import { Label } from "@content-desk/ui/components/label";
import type { AnyFieldApi } from "@tanstack/react-form";
import {
  type ChangeEvent,
  type HTMLInputTypeAttribute,
  useCallback,
} from "react";

interface FormTextFieldProps {
  field: AnyFieldApi;
  label: string;
  type?: HTMLInputTypeAttribute;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }

  return null;
}

export function FormTextField({ field, label, type }: FormTextFieldProps) {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      field.handleChange(event.target.value);
    },
    [field]
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={handleChange}
        type={type}
        value={field.state.value}
      />
      {field.state.meta.errors.map((error: unknown) => {
        const message = getErrorMessage(error);

        return message ? (
          <p className="text-red-500" key={`${field.name}-${message}`}>
            {message}
          </p>
        ) : null;
      })}
    </div>
  );
}
