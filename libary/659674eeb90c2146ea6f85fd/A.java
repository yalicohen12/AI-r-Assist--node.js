public class A {
    private int numA;
    protected int numX;
    public int numY;

    public A() {
        System.out.println("create in A");
        this.numA = numA;
    }

    public void display() {
        System.out.println("Number in A: " + numA);
    }
    public void A_func() {
        System.out.println("in A_func");
    }
}
