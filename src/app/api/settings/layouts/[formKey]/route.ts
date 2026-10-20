import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEFAULT_LAYOUTS } from "@/lib/defaultLayouts";

export const layoutCache: Record<string, { value: any; timestamp: number }> = {};
const CACHE_TTL = 300000; // 5 minutes

export function clearLayoutCache(formKey?: string) {
  if (formKey) {
    delete layoutCache[formKey];
  } else {
    Object.keys(layoutCache).forEach((k) => delete layoutCache[k]);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ formKey: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { formKey } = await params;

  if (layoutCache[formKey] && Date.now() - layoutCache[formKey].timestamp < CACHE_TTL) {
    console.log(`[Cache HIT] /api/settings/layouts/${formKey}`);
    return NextResponse.json(layoutCache[formKey].value);
  }
  console.log(`[Cache MISS] /api/settings/layouts/${formKey}`);

  try {
    let layout = await prisma.formLayout.findUnique({
      where: { formKey },
    });

    if (!layout) {
      // Fallback to default layout if not configured in DB yet
      const defaultLayout = DEFAULT_LAYOUTS.find((l) => l.formKey === formKey);
      if (defaultLayout) {
        layout = {
          id: `default-${formKey}`,
          formKey: defaultLayout.formKey,
          name: defaultLayout.name,
          description: defaultLayout.description,
          schema: defaultLayout.schema,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any;
      } else {
        return NextResponse.json({ error: "Layout not found" }, { status: 404 });
      }
    }

    layoutCache[formKey] = { value: layout, timestamp: Date.now() };
    return NextResponse.json(layout);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch form layout" }, { status: 500 });
  }
}
