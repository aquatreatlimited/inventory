"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";

const formSchema = z.object({
  emailPrefix: z.string().min(2, "Email prefix is required"),
  password: z.string().min(5, "Password must be at least 6 characters"),
});

export default function Login() {
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      emailPrefix: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true);
      const email = `${values.emailPrefix}@aquatreat.co.ke`;
      await signIn(email, values.password);
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className='flex min-h-screen bg-gradient-to-br from-blue-50 to-white'>
      <div className='flex-1 hidden lg:block bg-[#0086CB] relative overflow-hidden'>
        <div className='absolute inset-0 bg-gradient-to-br from-[#0086CB]/90 to-[#005A88]/90' />
        <div className='absolute inset-0 flex items-center justify-center p-12'>
          <div className='text-white space-y-8'>
            <h1 className='text-4xl font-bold'>
              Water & Effluent Treatment Specialists
            </h1>
          </div>
        </div>
      </div>

      <div className='flex-1 flex items-center justify-center p-8'>
        <Card className='w-full max-w-md border-0 shadow-xl bg-white/50 backdrop-blur-sm'>
          <CardHeader className='space-y-6 items-center text-center'>
            <div className='w-64 h-32 relative mx-auto'>
              <Image
                src='/logo.png'
                alt='Aquatreat Solutions Ltd Logo'
                fill
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
            <div>
              <CardTitle className='text-2xl font-bold text-[#0086CB]'>
                Staff Portal
              </CardTitle>
              <CardDescription className='text-gray-600'>
                Access the inventory management system
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className='space-y-4'>
                <FormField
                  control={form.control}
                  name='emailPrefix'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-gray-700'>
                        Work Email
                      </FormLabel>
                      <div className='flex rounded-md shadow-sm'>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder='name'
                            className='rounded-r-none border-r-0'
                            disabled={isLoading}
                            suppressHydrationWarning
                          />
                        </FormControl>
                        <span className='inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground'>
                          @aquatreat.co.ke
                        </span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='password'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-gray-700'>Password</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder='Enter your password'
                          className='bg-white/70 border-gray-200'
                          {...field}
                          disabled={isLoading}
                          suppressHydrationWarning
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  className='w-full bg-[#0086CB] hover:bg-[#005A88] text-white transition-colors'
                  type='submit'
                  disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  )}
                  Sign in
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className='flex flex-col space-y-4'>
            <div className='text-sm text-gray-600 text-center'>
              Forgot your password or need access? Contact IT Support
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
