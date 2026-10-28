'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { isApiError } from '@/lib/api/schemas';
import { handleFormError } from '@/lib/forms/handleFormError';
import { useLogin } from '../mutations';
import { loginInputSchema, type LoginInput } from '../schemas';
import { DemoAccounts } from './DemoAccounts';

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => router.replace('/dashboard'),
      onError: (error) => {
        if (isApiError(error) && error.code === 'INVALID_LOGIN_CREDENTIALS') {
          toast.error('Invalid email or password');
          return;
        }
        handleFormError(error, form);
      },
    });
  });

  const fillDemo = (email: string, password: string) => {
    form.setValue('email', email, { shouldValidate: true });
    form.setValue('password', password, { shouldValidate: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={errors.email ? true : undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={errors.email ? true : undefined}
              {...form.register('email')}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={errors.password ? true : undefined}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                disabled
                title="Password reset is not available yet"
              >
                Forgot?
              </Button>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              {...form.register('password')}
            />
            <FieldError errors={[errors.password]} />
          </Field>
          <Button type="submit" size="lg" disabled={login.isPending}>
            {login.isPending && <Spinner data-icon="inline-start" />}
            Sign in
          </Button>
        </FieldGroup>
      </form>
      <DemoAccounts onPick={fillDemo} />
    </div>
  );
}
