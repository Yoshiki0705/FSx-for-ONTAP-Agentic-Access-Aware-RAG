import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    console.log("[SignOut API] サインアウト処理開始");

    const response = NextResponse.json({ success: true });

    // session-token Cookieを削除
    response.cookies.set("session-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    console.log("✅ サインアウト成功");
    return response;
  } catch (error) {
    console.error("[SignOut API] エラー:", error);
    return NextResponse.json(
      { error: "サインアウトに失敗しました" },
      { status: 500 }
    );
  }
}
