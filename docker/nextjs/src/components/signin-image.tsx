import Image from "next/image";

export function SignInImage() {
  return (
    <div className="relative hidden bg-muted lg:block">
      <Image
        src="/images/main-image.jpg"
        alt="NetApp building with Intelligent Data Infrastructure signage"
        style={{ objectFit: "cover" }}
        fill={true}
      />
    </div>
  );
}
